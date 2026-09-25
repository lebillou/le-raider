// Pilotage des sociétés contrôlées : dette bancaire, dividendes, investissement, fusion.
import { flottant, societe } from './acces.js';
import { JOUEUR, estRaider } from './config.js';
import { controlees } from './controle.js';
import { caParEuro, journal } from './creation.js';
import { capaciteEmprunt, levier, ltv, notation } from './finance.js';
import { estHolding } from './secteurs.js';
import { apercuAchat, cloner, crediter } from './transactions.js';
import { fmtTitres } from './trimestre.js';

// ---------- PILOTAGE DES FILIALES ----------
export function filiale(s, id) {
  const ctrl = controlees(s);
  if (!ctrl.has(id)) throw new Error(`Vous ne contrôlez pas ${s.societes[id].nom}`);
  return societe(s, id);
}
export function emprunter(s0, id, montant) {
  if (!(montant > 0)) throw new Error('Montant invalide');
  const s = cloner(s0); const c = filiale(s, id);
  const cap = capaciteEmprunt(c, s);
  if (montant > cap + 1e-9) throw new Error(`Les banques ne prêtent que ${cap.toFixed(1)} M€ de plus à ${c.nom} (${estHolding(c) ? '50 % de la valeur de ses participations' : '4× l\'EBIT, 70 % des actifs'}).`);
  _emprunter(s, c, montant, 'filiale');
  return s;
}
export function _emprunter(s, c, montant, type, acteur = JOUEUR) {
  c.dette += montant; c.cash += montant;
  journal(s, type, `${c.nom} emprunte ${montant.toFixed(1)} M€ ; ${estHolding(c) ? `LTV ${Math.round(100 * ltv(s, c))} %` : `levier ${levier(c).toFixed(1)}×`}, notation ${notation(c, s)}.`, acteur);
}
export function rembourser(s0, id, montant) {
  if (!(montant > 0)) throw new Error('Montant invalide');
  const s = cloner(s0); const c = filiale(s, id);
  const m = Math.min(montant, c.dette);
  if (m > c.cash + 1e-9) throw new Error(`${c.nom} n'a que ${c.cash.toFixed(1)} M€ de trésorerie.`);
  c.dette -= m; c.cash -= m;
  journal(s, 'filiale', `${c.nom} rembourse ${m.toFixed(1)} M€ de dette ; notation ${notation(c, s)}.`, JOUEUR);
  return s;
}
export function distribuer(s, c, montant) {
  for (const [h, t] of Object.entries(c.actionnaires)) {
    const part = montant * t / c.actions;
    if (h === JOUEUR || estRaider(s, h)) crediter(s, h, part);
    else if (h !== 'public' && h !== 'noyau') s.societes[h].cash += part;
  }
  c.cash -= montant;
}
export function dividendeExceptionnel(s0, id, montant) {
  if (!(montant > 0)) throw new Error('Montant invalide');
  const s = cloner(s0); const c = filiale(s, id);
  if (montant > c.cash + 1e-9) throw new Error(`${c.nom} n'a que ${c.cash.toFixed(1)} M€ de trésorerie.`);
  distribuer(s, c, montant);
  journal(s, 'filiale', `${c.nom} verse un dividende exceptionnel de ${montant.toFixed(1)} M€ (${(montant / c.actions).toFixed(2)} € par action).`, JOUEUR);
  return s;
}
export function racheterActions(s0, id, montant) {
  if (!(montant > 0)) throw new Error('Montant invalide');
  const s = cloner(s0); const c = filiale(s, id);
  if (montant > c.cash + 1e-9) throw new Error(`${c.nom} n'a que ${c.cash.toFixed(1)} M€ de trésorerie.`);
  const ap = apercuAchat(s, id, montant);
  if (ap.titres <= 1e-6) throw new Error('Plus de flottant à racheter.');
  c.cash -= ap.cout;
  c.actionnaires.public -= ap.titres;
  c.actions -= ap.titres;               // titres annulés
  c.prix = ap.prixApres;
  journal(s, 'filiale', `${c.nom} rachète et annule ${fmtTitres(ap.titres)} (${ap.cout.toFixed(1)} M€) ; flottant ${Math.round(100 * flottant(c) / c.actions)} %.`, JOUEUR);
  return s;
}
export function investir(s0, id, montant) {
  if (!(montant > 0)) throw new Error('Montant invalide');
  const s = cloner(s0); const c = filiale(s, id);
  if (estHolding(c)) throw new Error(`${c.nom} est une holding : elle investit en achetant des titres, pas des actifs industriels.`);
  if (montant > c.cash + 1e-9) throw new Error(`${c.nom} n'a que ${c.cash.toFixed(1)} M€ de trésorerie.`);
  c.cash -= montant; c.actifs += montant;
  const gain = montant * caParEuro(c.secteur);
  c.caPipeline = (c.caPipeline || 0) + gain;   // l'activité nouvelle monte en charge sur deux ans
  journal(s, 'filiale', `${c.nom} investit ${montant.toFixed(1)} M€ ; ${Math.round(gain)} M€ de chiffre d'affaires supplémentaire attendus d'ici deux ans.`, JOUEUR);
  return s;
}
export function cederActifs(s0, id, montant) {
  if (!(montant > 0)) throw new Error('Montant invalide');
  const s = cloner(s0); const c = filiale(s, id);
  if (estHolding(c)) throw new Error(`${c.nom} est une holding : elle n'a pas d'actifs industriels ; cédez ses participations.`);
  const m = Math.min(montant, c.actifs * 0.6);
  c.actifs -= m; c.cash += m * 0.85;   // décote de cession
  c.ca = Math.max(c.ca - m * c.rot, c.ca * 0.3);
  journal(s, 'filiale', `${c.nom} cède ${m.toFixed(1)} M€ d'actifs pour ${(m * 0.85).toFixed(1)} M€ de trésorerie.`, JOUEUR);
  return s;
}
