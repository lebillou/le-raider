// Augmentations de capital : public, droit préférentiel, placement privé.
import { detenteursSocietes, societe } from './acces.js';
import { JOUEUR, RAIDER_BY_ID, clamp, estRaider, nomDetenteur } from './config.js';
import { controlees, detentionEffective, repartitionControle, simulerControle } from './controle.js';
import { journal } from './creation.js';
import { dispoActeur, estimation } from './ia.js';
import { filiale } from './pilotage.js';
import { cloner, crediter, debiter } from './transactions.js';
import { fmtTitres } from './trimestre.js';

// ---------- AUGMENTATION DE CAPITAL ----------
export const FRAIS_EMISSION = 0.03;          // banques et placement
export const DELAI_EMISSION = 4;             // trimestres entre deux augmentations de capital
export const MODES_EMISSION = {
  public: 'Placement dans le public',
  droits: 'Avec droit préférentiel de souscription',
  prive: 'Placement privé réservé',
};
// Décote du prix d'émission sur le cours, selon la forme et la taille relative de l'émission
export function decoteEmission(mode, taille) {
  if (mode === 'droits') return clamp(0.15 + 0.2 * taille, 0.15, 0.4);    // décote forte mais neutre : les droits la compensent
  if (mode === 'prive') return clamp(0.08 + 0.3 * taille, 0.08, 0.35);
  return clamp(0.04 + 0.3 * taille, 0.04, 0.3);
}
// Montant maximal levable : doubler le nombre d'actions au prix d'émission correspondant
export const montantMaxEmission = (c, mode) => c.actions * c.prix * (1 - decoteEmission(mode, 1));
export function apercuEmission(s, id, { montant, mode, souscrireJoueur = true, investisseur = null }, ctl = null) {
  const c = societe(s, id);
  if (!MODES_EMISSION[mode]) throw new Error('Forme d\'émission inconnue.');
  if (!(montant > 0)) throw new Error('Montant invalide');
  // Prix d'émission : point fixe entre la taille de l'émission et la décote qu'elle impose
  let prixEm = c.prix, n = montant / prixEm;
  for (let k = 0; k < 30; k++) { prixEm = c.prix * (1 - decoteEmission(mode, n / c.actions)); n = montant / prixEm; }
  if (n > c.actions * (1 + 1e-9)) throw new Error(`Une augmentation de capital ne peut pas plus que doubler le nombre d'actions : ${(montantMaxEmission(c, mode)).toFixed(1)} M€ au plus sous cette forme.`);
  const repartition = {};      // détenteur -> actions nouvelles souscrites
  const paiements = {};        // détenteur -> espèces versées (> 0) ou produit de cession des droits (< 0)
  const decisions = [];        // [nom, texte] pour l'aperçu
  const terpNet = (c.actions * c.prix + n * prixEm * (1 - FRAIS_EMISSION)) / (c.actions + n);
  const valeurDroit = Math.max(0, terpNet - prixEm);   // ce que vaut le droit de souscrire une action nouvelle
  const ajouter = (h, q) => { if (q > 1e-12) repartition[h] = (repartition[h] || 0) + q; };
  if (mode === 'public') {
    ajouter('public', n);
  } else if (mode === 'prive') {
    if (!investisseur || !estRaider(s, investisseur) || !s.raiders[investisseur].actif) throw new Error('Choisissez le groupe à qui réserver l\'émission.');
    const rd = RAIDER_BY_ID[investisseur];
    const est = estimation(s, investisseur, c);
    const capacite = dispoActeur(s, investisseur, rd.margeMax) * 0.6;
    if (prixEm > est) decisions.push([rd.nom, `décline : il estime le titre à ${est.toFixed(2)} €, au-dessous du prix d'émission`]);
    else if (capacite < 0.5) decisions.push([rd.nom, 'décline : pas les moyens']);
    else {
      const q = Math.min(n, capacite / prixEm);
      ajouter(investisseur, q);
      decisions.push([rd.nom, `souscrit ${fmtTitres(q)} pour ${(q * prixEm).toFixed(1)} M€${q < n - 1e-9 ? ' (tout ce qu\'il peut engager)' : ''}`]);
      paiements[investisseur] = q * prixEm;
    }
    n = repartition[investisseur] || 0;
    if (n <= 1e-9) return { mode, prixEm, decote: 1 - prixEm / c.prix, n: 0, brut: 0, net: 0, terp: c.prix, repartition, paiements, decisions, dilution: 0, vide: true };
  } else {
    // Droit préférentiel : chaque actionnaire peut souscrire au prorata ; s'il renonce, ses droits sont vendus sur le marché
    for (const [h, t] of Object.entries(c.actionnaires)) {
      const part = n * t / c.actions;
      if (part <= 1e-12) continue;
      if (h === 'public') { ajouter('public', part); continue; }
      if (h === 'noyau') { ajouter('public', part); decisions.push(['Noyau dur', 'vend ses droits']); continue; }
      const cout = part * prixEm;
      let souscrit;
      if (h === JOUEUR) souscrit = souscrireJoueur;
      else if (estRaider(s, h)) souscrit = estimation(s, h, c) > prixEm && dispoActeur(s, h, RAIDER_BY_ID[h].margeMax) >= cout;
      else souscrit = s.societes[h].cash >= cout;
      if (souscrit) { ajouter(h, part); paiements[h] = (paiements[h] || 0) + cout; }
      else { ajouter('public', part); paiements[h] = (paiements[h] || 0) - part * valeurDroit; }
      decisions.push([nomDetenteur(s, h), souscrit ? `souscrit ${fmtTitres(part)} pour ${cout.toFixed(1)} M€` : `vend ses droits pour ${(part * valeurDroit).toFixed(1)} M€`]);
    }
  }
  const brut = n * prixEm, net = brut * (1 - FRAIS_EMISSION);
  const terp = (c.actions * c.prix + net) / (c.actions + n);          // prix théorique après émission, frais déduits
  ctl = ctl || repartitionControle(s);
  const ctrlJ = controlees(s, JOUEUR, ctl);
  const detAvant = detentionEffective(s, id, ctrlJ);
  let detApresT = (c.actionnaires[JOUEUR] || 0) + (repartition[JOUEUR] || 0);
  for (const h of detenteursSocietes(s, c)) if (ctrlJ.has(h)) detApresT += c.actionnaires[h] + (repartition[h] || 0);
  const controleApres = simulerControle(s, id, repartition, n, ctl);
  return {
    mode, prixEm, decote: 1 - prixEm / c.prix, n, brut, net, terp, valeurDroit, repartition, paiements, decisions,
    dilution: n / (c.actions + n), detAvant, detApres: detApresT / (c.actions + n),
    controleAvant: ctl[id] || null, controleApres, garderControle: controleApres === (ctl[id] || null),
    coutJoueur: Math.max(0, paiements[JOUEUR] || 0), droitsJoueur: Math.max(0, -(paiements[JOUEUR] || 0)),
  };
}
export function emettreActions(s0, id, params) {
  const s = cloner(s0); const c = filiale(s, id);
  if (c.derniereEmission !== undefined && s.tour - c.derniereEmission < DELAI_EMISSION) throw new Error(`${c.nom} a déjà levé des fonds récemment : prochaine augmentation de capital possible dans ${DELAI_EMISSION - (s.tour - c.derniereEmission)} trimestre(s).`);
  if (!(params.montant >= 1)) throw new Error('Montant minimum : 1 M€.');
  const ap = apercuEmission(s, id, params);
  if (ap.vide) throw new Error(ap.decisions.map(d => d.join(' ')).join(' ; ') || 'Personne ne souscrit.');
  // Règlements : les souscripteurs paient, les vendeurs de droits encaissent
  for (const [h, v] of Object.entries(ap.paiements)) {
    if (v > 0) {
      const valeurRecue = (ap.repartition[h] || 0) * ap.terp;
      if (h === JOUEUR || estRaider(s, h)) debiter(s, h, v, valeurRecue);
      else debiter(s, h, v);
    } else if (v < 0) crediter(s, h, -v);
  }
  for (const [h, q] of Object.entries(ap.repartition)) c.actionnaires[h] = (c.actionnaires[h] || 0) + q;
  c.actions += ap.n;
  c.cash += ap.net;
  c.prix = ap.terp;
  c.derniereEmission = s.tour;
  const qui = params.mode === 'prive' ? ` réservée à ${nomDetenteur(s, params.investisseur)}` : params.mode === 'droits' ? ' avec droit préférentiel' : ' dans le public';
  journal(s, 'filiale', `${c.nom} réalise une augmentation de capital${qui} : ${fmtTitres(ap.n)} nouveaux à ${ap.prixEm.toFixed(2)} € (décote ${Math.round(100 * ap.decote)} %), ${ap.net.toFixed(1)} M€ levés nets${params.mode === 'droits' && params.souscrireJoueur === false && ap.droitsJoueur > 0 ? ` ; vous vendez vos droits pour ${ap.droitsJoueur.toFixed(1)} M€` : ''}.`, JOUEUR);
  return s;
}
