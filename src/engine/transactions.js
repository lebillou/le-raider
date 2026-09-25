// Outils communs aux ordres : débit, crédit, antitrust, aperçus d'achat et de vente.
import { actives, flottant, societe, valeurParticipations } from './acces.js';
import { ANTITRUST, COMMISSION, IMPACT, JOUEUR, MARGE_MAX, compte, estRaider, nomDetenteur } from './config.js';
import { controlees } from './controle.js';
import { SECT_BY_ID } from './secteurs.js';

// ---------- OUTILS DE TRANSACTION ----------
export const cloner = (s) => structuredClone(s);
export const nomActeur = (s, h) => nomDetenteur(s, h);

export function verifierActeur(s, acteur, ctrl) {
  if (acteur === JOUEUR || estRaider(s, acteur)) return;
  if (!ctrl.has(acteur)) throw new Error(`Vous ne contrôlez pas ${s.societes[acteur].nom}`);
}
export const proprietaire = (s, acteur) => estRaider(s, acteur) ? acteur : JOUEUR;
export function verifierAntitrust(s, ctrlAvant, holder = JOUEUR) {
  const ctrlApres = controlees(s, holder);
  for (const id of ctrlApres) {
    if (ctrlAvant.has(id)) continue;
    const sec = s.societes[id].secteur;
    if (sec === 'holding') continue;
    let total = 0, ctrlCa = 0;
    for (const c of actives(s)) if (c.secteur === sec) { total += c.ca; if (ctrlApres.has(c.id)) ctrlCa += c.ca; }
    if (ctrlCa / total > ANTITRUST) {
      throw new Error(`L'Autorité de la concurrence bloque la prise de contrôle de ${s.societes[id].nom} : ${holder === JOUEUR ? 'vous contrôleriez' : nomDetenteur(s, holder) + ' contrôlerait'} ${Math.round(100 * ctrlCa / total)} % du secteur ${SECT_BY_ID[sec].nom}.`);
    }
  }
}
// Débit d'un acteur, avec recours à la marge pour le joueur
export function debiter(s, acteur, montant, valeurAjoutee = 0) {
  if (acteur === JOUEUR || estRaider(s, acteur)) {
    const j = compte(s, acteur);
    if (montant <= j.cash) { j.cash -= montant; return; }
    const manque = montant - j.cash;
    const portefeuilleApres = valeurParticipations(s, acteur) + valeurAjoutee;
    if (j.marge + manque > MARGE_MAX * portefeuilleApres + 1e-9) {
      throw new Error(`Trésorerie insuffisante : il manque ${manque.toFixed(1)} M€ et la marge est plafonnée à ${(MARGE_MAX * portefeuilleApres).toFixed(1)} M€ (50 % du portefeuille).`);
    }
    j.marge += manque; j.cash = 0;
    return;
  }
  const c = s.societes[acteur];
  if (montant > c.cash + 1e-9) throw new Error(`${c.nom} n'a que ${c.cash.toFixed(1)} M€ de trésorerie.`);
  c.cash -= montant;
}
export function crediter(s, acteur, montant) {
  if (acteur === JOUEUR || estRaider(s, acteur)) {
    const j = compte(s, acteur);
    const remb = Math.min(j.marge, montant);
    j.marge -= remb; j.cash += montant - remb;
  } else s.societes[acteur].cash += montant;
}

// Aperçu d'un achat au marché (sans modifier l'état)
export function apercuAchat(s, cibleId, montant) {
  const c = societe(s, cibleId);
  const flot = flottant(c);
  // montant = q × prix × (1 + IMPACT q / (2 actions)) × (1+commission) → résolution quadratique en q
  const k = IMPACT / (2 * c.actions);
  const m = montant / (1 + COMMISSION);
  let q = (-1 + Math.sqrt(1 + 4 * k * m / c.prix)) / (2 * k);
  q = Math.min(q, flot);
  const impact = IMPACT * q / c.actions;
  const prixMoyen = c.prix * (1 + impact / 2);
  const cout = q * prixMoyen * (1 + COMMISSION);
  return { titres: q, prixMoyen, cout, prixApres: c.prix * (1 + impact), flottant: flot, pctApres: q / c.actions };
}
export function apercuVente(s, holder, cibleId, titres) {
  const c = societe(s, cibleId);
  const q = Math.min(titres, c.actionnaires[holder] || 0);
  const impact = Math.min(0.9, IMPACT * q / c.actions);
  const prixMoyen = c.prix * (1 - impact / 2);
  return { titres: q, prixMoyen, produit: q * prixMoyen * (1 - COMMISSION), prixApres: c.prix * (1 - impact) };
}
