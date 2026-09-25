// Ordres de bourse et offres publiques (OPA, OPE, offres mixtes).
import { detenteursSocietes, flottant, pct, societe, valeurParticipations } from './acces.js';
import { COMMISSION, FRAIS_OPA, JOUEUR, MARGE_MAX, PRIME_NOYAU, RAIDERS, clamp, compte, estRaider, nomDetenteur } from './config.js';
import { controlees, controleursChaine, repartitionControle, simulerControle } from './controle.js';
import { journal } from './creation.js';
import { apercuAchat, apercuVente, cloner, crediter, debiter, nomActeur, proprietaire, verifierActeur, verifierAntitrust } from './transactions.js';
import { fmtTitres } from './trimestre.js';

// ---------- ACTIONS DU JOUEUR ----------
export function acheter(s0, acteur, cibleId, montant) {
  if (!(montant > 0)) throw new Error('Montant invalide');
  const s = cloner(s0);
  const ctrl = controlees(s);
  verifierActeur(s, acteur, ctrl);
  const c = societe(s, cibleId);
  if (acteur === cibleId) throw new Error('Une société ne peut acheter ses propres titres que par rachat d\'actions.');
  if (acteur !== JOUEUR && !estRaider(s, acteur) && controleursChaine(s, acteur).has(cibleId)) throw new Error(`Autocontrôle interdit : ${c.nom} contrôle ${s.societes[acteur].nom}.`);
  const ap = apercuAchat(s, cibleId, montant);
  if (ap.titres <= 1e-6) throw new Error('Plus aucun titre disponible sur le marché : il faut lancer une OPA.');
  debiter(s, acteur, ap.cout, ap.titres * ap.prixMoyen);
  c.actionnaires.public -= ap.titres;
  c.actionnaires[acteur] = (c.actionnaires[acteur] || 0) + ap.titres;
  c.prix = ap.prixApres;
  verifierAntitrust(s, controlees(s0, proprietaire(s, acteur)), proprietaire(s, acteur));
  journal(s, estRaider(s, acteur) ? 'concurrent' : 'achat', `${nomActeur(s, acteur)} achète ${fmtTitres(ap.titres)} ${c.nom} à ${ap.prixMoyen.toFixed(2)} € (${ap.cout.toFixed(1)} M€).`, proprietaire(s, acteur));
  return s;
}

export function vendre(s0, acteur, cibleId, titres) {
  if (!(titres > 0)) throw new Error('Quantité invalide');
  const s = cloner(s0);
  const ctrl = controlees(s);
  verifierActeur(s, acteur, ctrl);
  const c = societe(s, cibleId);
  const ap = apercuVente(s, acteur, cibleId, titres);
  if (ap.titres <= 1e-6) throw new Error('Aucun titre à vendre');
  c.actionnaires[acteur] -= ap.titres;
  if (c.actionnaires[acteur] < 1e-9) delete c.actionnaires[acteur];
  c.actionnaires.public += ap.titres;
  c.prix = ap.prixApres;
  crediter(s, acteur, ap.produit);
  journal(s, estRaider(s, acteur) ? 'concurrent' : 'vente', `${nomActeur(s, acteur)} cède ${fmtTitres(ap.titres)} ${c.nom} à ${ap.prixMoyen.toFixed(2)} € (${ap.produit.toFixed(1)} M€).`, proprietaire(s, acteur));
  return s;
}

// Fraction du flottant apportée à une OPA selon la prime
export const tauxApport = (prime) => clamp(0.97 / (1 + Math.exp(-(prime - 0.22) / 0.075)), 0, 0.97);

// Le papier vaut moins que le numéraire aux yeux des actionnaires sollicités
export const DECOTE_PAPIER = 0.05;
// Décote des cessions forcées de blocs (appel de marge, covenant)
export const DECOTE_BLOC = 0.15;
export const natureOffre = (numeraire) => numeraire >= 1 - 1e-9 ? 'OPA' : numeraire <= 1e-9 ? 'OPE' : 'Offre mixte';

// numeraire : part de l'offre réglée en espèces (1 = OPA, 0 = OPE, entre les deux = offre mixte).
// La part en titres est réglée en actions nouvelles de l'initiateur, émises au cours.
// Groupe de vote d'un acteur : vous, un raider, ou le groupe qui contrôle la société qui agit
export function groupeActeur(s, acteur, ctl) {
  if (!s.societes[acteur]) return acteur;
  return ctl[acteur] || acteur;
}
export function apercuOPA(s, acteur, cibleId, prime, numeraire = 1, ctl = null) {
  const c = societe(s, cibleId);
  const prixOffre = c.prix * (1 + prime);
  const primeEff = prime - DECOTE_PAPIER * (1 - numeraire);
  const apportPublic = flottant(c) * tauxApport(primeEff);
  const apportNoyau = primeEff >= PRIME_NOYAU - 1e-9 ? (c.actionnaires.noyau || 0) : 0;
  const apportRaiders = {};
  for (const r of RAIDERS) if (r.id !== acteur && s.raiders?.[r.id]?.actif && c.actionnaires[r.id] > 0 && primeEff >= r.seuilApport - 1e-9) apportRaiders[r.id] = c.actionnaires[r.id];
  const totalRaiders = Object.values(apportRaiders).reduce((a, b) => a + b, 0);
  const titres = apportPublic + apportNoyau + totalRaiders;
  const valeur = titres * prixOffre;
  const cout = valeur * numeraire + valeur * FRAIS_OPA;          // espèces à décaisser (frais toujours en espèces)
  const detApres = ((c.actionnaires[acteur] || 0) + titres) / c.actions;
  const res = { prixOffre, primeEff, titres, apportPublic, apportNoyau, apportRaiders, totalRaiders, valeur, cout, detApres, noyau: c.actionnaires.noyau || 0, numeraire, parite: 0, titresEmis: 0 };
  // Contrôle de la cible après l'offre
  ctl = ctl || repartitionControle(s);
  const groupe = groupeActeur(s, acteur, ctl);
  const deltas = { [acteur]: titres, public: -apportPublic };
  if (apportNoyau > 0) deltas.noyau = -apportNoyau;
  for (const [rid, t] of Object.entries(apportRaiders)) deltas[rid] = -t;
  res.groupe = groupe;
  res.controleAvant = ctl[cibleId] || null;
  res.controleApres = simulerControle(s, cibleId, deltas, 0, ctl);
  res.prendControle = res.controleApres === groupe;
  if (numeraire < 1 && s.societes[acteur]) {
    const a = s.societes[acteur];
    res.parite = prixOffre * (1 - numeraire) / a.prix;              // titres initiateur remis par titre cible
    res.titresEmis = titres * res.parite;
    const actionsApres = a.actions + res.titresEmis;
    const ctrl = controlees(s, JOUEUR, ctl);
    let det = (a.actionnaires[JOUEUR] || 0);
    for (const h of detenteursSocietes(s, a)) if (ctrl.has(h)) det += a.actionnaires[h];
    res.detInitiateurAvant = det / a.actions;
    res.detInitiateurApres = det / actionsApres;
    res.dilution = res.titresEmis / actionsApres;
    // Contrôle de l'initiateur après émission : les apporteurs deviennent ses actionnaires
    const dI = { public: (apportPublic + apportNoyau) * res.parite };
    for (const [rid, t] of Object.entries(apportRaiders)) dI[rid] = t * res.parite;
    res.controleInitiateurApres = simulerControle(s, acteur, dI, res.titresEmis, ctl);
    res.garderControleInitiateur = !ctl[acteur] || res.controleInitiateurApres === ctl[acteur];
  }
  return res;
}

export function lancerOPA(s0, acteur, cibleId, prime, numeraire = 1) {
  if (!(prime >= 0) || prime > 1.5) throw new Error('Prime invalide (0 à 150 %)');
  if (!(numeraire >= 0 && numeraire <= 1)) throw new Error('Part en numéraire invalide (0 à 100 %)');
  const s = cloner(s0);
  const ctrl = controlees(s);
  verifierActeur(s, acteur, ctrl);
  const c = societe(s, cibleId);
  const nature = natureOffre(numeraire);
  if (acteur === cibleId) throw new Error('Une société ne peut lancer une offre sur elle-même.');
  if (numeraire < 1 && !s.societes[acteur]) throw new Error('Pour payer en titres, lancez l\'offre au nom d\'une société que vous contrôlez : ce sont ses actions nouvelles qui rémunèrent les apporteurs.');
  if (acteur !== JOUEUR && !estRaider(s, acteur) && controleursChaine(s, acteur).has(cibleId)) throw new Error(`Autocontrôle interdit : ${c.nom} contrôle ${s.societes[acteur].nom}.`);
  if (numeraire < 1 && (s.societes[acteur].actionnaires[cibleId] || 0) > 0) throw new Error(`${c.nom} détient des titres ${s.societes[acteur].nom} : une offre d'échange créerait de l'autocontrôle. Faites-lui céder cette participation d'abord.`);
  const ap = apercuOPA(s, acteur, cibleId, prime, numeraire);
  if (ap.titres <= 1e-6) throw new Error('Aucun titre ne serait apporté à cette offre.');
  // L'offre est garantie : il faut pouvoir régler la part en espèces de tous les titres apportés
  debiter(s, acteur, ap.cout, ap.titres * ap.prixOffre);
  c.actionnaires.public -= ap.apportPublic;
  if (ap.apportNoyau > 0) delete c.actionnaires.noyau;
  // Part en titres : actions nouvelles de l'initiateur remises aux apporteurs, au prorata
  const initiateur = numeraire < 1 ? s.societes[acteur] : null;
  const remettre = (h, t) => {
    if (!initiateur) return;
    const n = t * ap.parite;
    initiateur.actions += n;
    const dest = h === 'noyau' ? 'public' : h;
    initiateur.actionnaires[dest] = (initiateur.actionnaires[dest] || 0) + n;
  };
  remettre('public', ap.apportPublic);
  remettre('noyau', ap.apportNoyau);
  for (const [rid, t] of Object.entries(ap.apportRaiders)) { delete c.actionnaires[rid]; crediter(s, rid, t * ap.prixOffre * numeraire); remettre(rid, t); }
  c.actionnaires[acteur] = (c.actionnaires[acteur] || 0) + ap.titres;
  // Le marché intègre l'offre : le cours converge vers le prix offert, pondéré par la part restée cotée
  c.prix = c.prix * (1 + prime * 0.5);
  verifierAntitrust(s, controlees(s0, proprietaire(s, acteur)), proprietaire(s, acteur));
  // Un raider qui vise une société où vous détenez des titres vous laisse la décision d'apporter
  if (estRaider(s, acteur) && c.actionnaires[JOUEUR] > 0) s.offres.push({ acteur, cible: c.id, prixOffre: ap.prixOffre, tour: s.tour });
  s.stats.opa++;
  const apportsR = Object.keys(ap.apportRaiders).map(r => nomDetenteur(s, r)).join(', ');
  const reglement = numeraire >= 1 - 1e-9 ? '' : ` (${numeraire > 1e-9 ? `dont ${(ap.valeur * numeraire).toFixed(1)} M€ en numéraire, ` : ''}${fmtTitres(ap.titresEmis)} ${initiateur.nom} émis, parité ${ap.parite.toFixed(3)})`;
  journal(s, estRaider(s, acteur) ? 'concurrent' : 'opa', `${nature} de ${nomActeur(s, acteur)} sur ${c.nom} à ${ap.prixOffre.toFixed(2)} € (+${Math.round(prime * 100)} %) : ${fmtTitres(ap.titres)} apportés${apportsR ? ` (dont ${apportsR})` : ''}, ${Math.round(100 * pct(c, acteur))} % du capital, ${ap.valeur.toFixed(1)} M€${reglement}.${estRaider(s, acteur) && c.actionnaires[JOUEUR] > 0 ? ' Vous pouvez apporter vos titres à ce prix jusqu\'à la clôture du trimestre.' : ''}`, proprietaire(s, acteur));
  return s;
}

// Le joueur apporte ses titres à l'offre en cours d'un raider
export function apporterAOffre(s0, cibleId) {
  const s = cloner(s0);
  const o = s.offres.find(x => x.cible === cibleId);
  if (!o) throw new Error('Aucune offre en cours sur cette société.');
  const c = societe(s, cibleId);
  const r = compte(s, o.acteur);
  const q0 = c.actionnaires[JOUEUR] || 0;
  if (q0 <= 1e-9) throw new Error('Vous ne détenez aucun titre à apporter.');
  const capacite = r.cash + Math.max(0, MARGE_MAX * (valeurParticipations(s, o.acteur) + q0 * o.prixOffre) - r.marge);
  const q = Math.min(q0, capacite / (o.prixOffre * (1 + FRAIS_OPA)));
  if (q <= 1e-9) throw new Error(`${nomDetenteur(s, o.acteur)} n'a plus les moyens de régler l'offre.`);
  debiter(s, o.acteur, q * o.prixOffre * (1 + FRAIS_OPA), q * o.prixOffre);
  crediter(s, JOUEUR, q * o.prixOffre * (1 - COMMISSION));
  c.actionnaires[JOUEUR] -= q; if (c.actionnaires[JOUEUR] < 1e-9) delete c.actionnaires[JOUEUR];
  c.actionnaires[o.acteur] = (c.actionnaires[o.acteur] || 0) + q;
  s.offres = s.offres.filter(x => x !== o);
  journal(s, 'vente', `Vous apportez ${fmtTitres(q)} ${c.nom} à l'offre de ${nomDetenteur(s, o.acteur)} à ${o.prixOffre.toFixed(2)} € (${(q * o.prixOffre).toFixed(1)} M€)${q < q0 - 1e-6 ? ' ; le reste n\'a pu être réglé' : ''}.`, JOUEUR);
  return s;
}
