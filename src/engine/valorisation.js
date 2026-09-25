// Valeur fondamentale, prix cible, PER, résultat net.
import { capi, valeurParticipations } from './acces.js';
import { IMPOT, clamp } from './config.js';
import { fixeAnnuel } from './dirigeants.js';
import { interetsComptesCourants, totalComptesCourants } from './comptes.js';
import { couponsAnnuels, detteTotale, ebitAnnuel, ebitNormatif, tauxEmprunt } from './finance.js';
import { DECOTE_HOLDING, SECT_BY_ID, estHolding } from './secteurs.js';

// ---------- VALORISATION ----------
export function multiple(s, c) {
  const sec = SECT_BY_ID[c.secteur];
  const conj = clamp(sec.beta * s.conj + (s.conjSecteurs[c.secteur] || 0), -1.2, 1.2);
  const fTaux = clamp((0.045 + 0.01) / (s.taux + 0.01), 0.6, 1.6);
  return sec.mult * (1 + 0.4 * conj) * Math.pow(fTaux, 0.5);
}
// Part du chiffre d'affaires en construction que le marché valorise déjà
export const ANTICIPATION = 0.75;
// Le marché capitalise l'EBIT normatif : les dépenses de croissance, de R&D ou de marketing
// comptent pour ce qu'elles coûtent en trésorerie et pour leurs effets, pas pour leur poids dans le résultat publié.
// Valeur d'entreprise de l'exploitation (nulle pour une holding, dont le multiple est nul)
export function valeurEntreprise(s, c) {
  const ebit = ebitNormatif(c) + ANTICIPATION * (c.caPipeline || 0) * c.margeRef;
  return Math.max(ebit, 0.02 * c.ca) * multiple(s, c);
}
// participations : valeur au cours des titres détenus, passée explicitement pour une société pas encore créée
export function prixCible(s, c, participations = valeurParticipations(s, c.id)) {
  const part = participations * (estHolding(c) ? 1 - DECOTE_HOLDING : 1);
  const cp = valeurEntreprise(s, c) - detteTotale(c) - totalComptesCourants(c) + c.cash + part;
  return Math.max(cp, 0.02 * c.ca, 0.001) / c.actions;
}
export const per = (s, c) => {
  const rn = resultatNetAnnuel(s, c);
  return rn > 0 ? capi(c) / rn : null;
};
export function resultatNetAnnuel(s, c) {
  const rb = ebitAnnuel(c) + 4 * (c.divRecus || 0) - c.dette * tauxEmprunt(s, c) - couponsAnnuels(c) - interetsComptesCourants(s, c) - (c.ceo ? fixeAnnuel(c) : 0);
  return rb > 0 ? rb * (1 - IMPOT) : rb;
}
