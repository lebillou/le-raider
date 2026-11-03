// Franchissements de seuils, offre publique obligatoire à 30 %, retrait obligatoire à 90 %.
import { actives, societe } from './acces.js';
import { COMMISSION, FRAIS_OPA, IMPACT, JOUEUR, RAIDERS, RAIDER_BY_ID, SEUIL_CONTROLE, clamp, estRaider } from './config.js';
import { controlees, controleursChaine, detentionEffective, repartitionControle } from './controle.js';
import { journal } from './creation.js';
import { solderDecouvertsRetrait } from './decouvert.js';
import { cloner, crediter, debiter, proprietaire, verifierActeur } from './transactions.js';
import { fmtTitres } from './trimestre.js';
import { prixCible } from './valorisation.js';

// ---------- DÉCLARATIONS DE FRANCHISSEMENT DE SEUIL ----------
// Comme en France, chaque groupe (vous ou un raider, avec les sociétés qu'il contrôle) déclare publiquement
// le franchissement des seuils de détention du capital. Les déclarations sont publiées à la clôture :
// ce qui reste sous 5 % est invisible ; au-delà, le marché et les raiders savent, et le cours s'anime
// quand un groupe monte au capital (le marché anticipe une offre).
export const SEUILS = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.50, 0.90];
export const SEUIL_OFFRE_OBLIGATOIRE = 0.30;
export const SEUIL_RETRAIT = 0.90;
export const ANTICIPATION_OFFRE = 0.03;      // sentiment ajouté quand un groupe franchit à la hausse un seuil de 10 à 30 %
export const niveauSeuil = (p) => SEUILS.filter(x => p >= x - 1e-9).pop() || 0;
export const partDeclaree = (s, cid, h = JOUEUR) => s.declarations?.[cid]?.[h] || 0;
const groupes = (s) => [JOUEUR, ...RAIDERS.map(r => r.id).filter(id => s.raiders[id]?.actif)];
export const detentionGroupe = (s, cid, h, ctl) => detentionEffective(s, cid, controlees(s, h, ctl), h);

// Publie les franchissements depuis la dernière publication. La première fois (nouvelle partie ou ancienne
// sauvegarde), enregistre l'état sans rien annoncer.
export function publierDeclarations(s, ctl = repartitionControle(s)) {
  const premiere = !s.declarations;
  const decl = s.declarations || {};
  const ctrls = Object.fromEntries(groupes(s).map(h => [h, controlees(s, h, ctl)]));
  for (const c of actives(s)) {
    for (const h of groupes(s)) {
      const p = detentionEffective(s, c.id, ctrls[h], h);
      const niv = niveauSeuil(p), avant = decl[c.id]?.[h] || 0;
      if (niv === avant) continue;
      decl[c.id] = { ...(decl[c.id] || {}), [h]: niv };
      if (!niv) delete decl[c.id][h];
      if (premiere) continue;
      const hausse = niv > avant;
      const seuil = hausse ? niv : SEUILS.find(x => x > niv + 1e-9);   // à la baisse, le plus bas des seuils repassés
      const qui = h === JOUEUR ? 'Vous déclarez' : `${RAIDER_BY_ID[h].nom} déclare`;
      journal(s, h === JOUEUR ? 'achat' : 'concurrent', `${qui} avoir franchi à la ${hausse ? 'hausse' : 'baisse'} le seuil de ${Math.round(100 * seuil)} % du capital de ${c.nom} (${(100 * p).toFixed(1).replace('.', ',')} %).`, h);
      if (hausse && niv >= 0.10 && niv <= SEUIL_OFFRE_OBLIGATOIRE && !ctrls[h].has(c.id)) c.sentiment = clamp((c.sentiment || 0) + ANTICIPATION_OFFRE, -0.5, 0.5);
    }
  }
  for (const id of Object.keys(decl)) if (!s.societes[id]?.active || !Object.keys(decl[id]).length) delete decl[id];
  s.declarations = decl;
}

// ---------- OFFRE PUBLIQUE OBLIGATOIRE ----------
// Un groupe qui franchit 30 % du capital doit déposer une offre sur la totalité ; entre 30 et 50 %, il ne
// peut se renforcer que par une offre. Les achats au marché sont donc plafonnés : au-delà, il faut une OPA.
export function plafondAvantOffre(s, acteur, cid, ctl = repartitionControle(s)) {
  const c = societe(s, cid);
  const det = detentionGroupe(s, cid, proprietaire(s, acteur), ctl);
  if (det >= SEUIL_CONTROLE - 1e-9) return Infinity;
  return Math.max(0, (SEUIL_OFFRE_OBLIGATOIRE - det) * c.actions);
}
// Montant d'achat au marché qui amène exactement au plafond (même formule d'impact que apercuAchat)
export function montantAvantOffre(s, acteur, cid, ctl) {
  const c = societe(s, cid), q = plafondAvantOffre(s, acteur, cid, ctl);
  return q === Infinity ? Infinity : q * c.prix * (1 + IMPACT * q / (2 * c.actions)) * (1 + COMMISSION);
}
export function messageOffreObligatoire(s, acteur, cid, plafond) {
  const c = s.societes[cid];
  const qui = proprietaire(s, acteur) === JOUEUR ? 'votre groupe' : RAIDER_BY_ID[proprietaire(s, acteur)].nom;
  return plafond > 1e-6
    ? `Au-delà de 30 % du capital de ${c.nom}, la loi impose une offre publique sur la totalité : ${qui} peut encore acheter au marché ${fmtTitres(plafond)} (${(plafond * c.prix).toFixed(1)} M€ environ). Pour aller plus loin, lancez une OPA.`
    : `Entre 30 et 50 % du capital de ${c.nom}, ${qui} ne peut se renforcer que par une offre publique : lancez une OPA.`;
}

// ---------- RETRAIT OBLIGATOIRE ----------
// À 90 % du capital, votre groupe peut exproprier les minoritaires : indemnisation au plus haut du cours
// et de la valeur fondamentale (l'expert indépendant ne descend pas sous le cours), puis sortie de la cote.
// Une société non cotée est évaluée chaque trimestre à sa valeur fondamentale ; elle revient en bourse dès
// que des titres sont à nouveau dans le public (vente, augmentation de capital dans le public).
export function apercuRetrait(s, cid, ctl = repartitionControle(s)) {
  const c = societe(s, cid);
  const ctrl = controlees(s, JOUEUR, ctl);
  const det = detentionEffective(s, cid, ctrl, JOUEUR);
  const minoritaires = Object.entries(c.actionnaires).filter(([h, t]) => t > 1e-12 && h !== JOUEUR && !ctrl.has(h));
  const titres = minoritaires.reduce((a, [, t]) => a + t, 0);
  const prix = Math.max(c.prix, prixCible(s, c));
  return { det, possible: det >= SEUIL_RETRAIT - 1e-9 && titres > 1e-9, prix, titres, cout: titres * prix * (1 + FRAIS_OPA), minoritaires };
}
export function retraitObligatoire(s0, acteur, cid) {
  const s = cloner(s0);
  const ctrl = controlees(s);
  verifierActeur(s, acteur, ctrl);
  if (estRaider(s, acteur)) throw new Error('Retrait réservé à votre groupe.');
  const c = societe(s, cid);
  if (acteur === cid) throw new Error(`${c.nom} ne peut pas racheter ses propres minoritaires par un retrait obligatoire : choisissez qui paie.`);
  if (acteur !== JOUEUR && controleursChaine(s, acteur).has(cid)) throw new Error(`Autocontrôle interdit : ${c.nom} contrôle ${s.societes[acteur].nom}.`);
  const ap = apercuRetrait(s, cid);
  if (ap.det < SEUIL_RETRAIT - 1e-9) throw new Error(`Le retrait obligatoire exige ${Math.round(100 * SEUIL_RETRAIT)} % du capital : votre groupe en détient ${(100 * ap.det).toFixed(1)} %.`);
  if (ap.titres <= 1e-9) throw new Error(`Il ne reste aucun minoritaire chez ${c.nom}.`);
  debiter(s, acteur, ap.cout, ap.titres * ap.prix);
  for (const [h, t] of ap.minoritaires) {
    delete c.actionnaires[h];
    if (h === 'public' || h === 'noyau') continue;           // indemnisés, ils sortent du jeu
    if (estRaider(s, h)) crediter(s, h, t * ap.prix);
    else s.societes[h].cash += t * ap.prix;
  }
  c.actionnaires.public = 0;
  c.actionnaires[acteur] = (c.actionnaires[acteur] || 0) + ap.titres;
  c.prix = ap.prix;
  c.nonCotee = true;
  s.offres = s.offres.filter(o => o.cible !== cid);
  solderDecouvertsRetrait(s, c, ap.prix);
  journal(s, 'opa', `Retrait obligatoire de ${c.nom} : ${fmtTitres(ap.titres)} indemnisés à ${ap.prix.toFixed(2)} € (${ap.cout.toFixed(1)} M€) ; la société quitte la cote.`, JOUEUR);
  return s;
}
// À la clôture : une société retirée revient en bourse si des titres sont repassés dans le public
export function reintroductions(s) {
  for (const c of actives(s)) {
    if (!c.nonCotee || !((c.actionnaires.public || 0) > 1e-9)) continue;
    delete c.nonCotee;
    journal(s, 'info', `${c.nom} revient en bourse : des titres sont à nouveau dans le public.`, 'marche');
  }
}
