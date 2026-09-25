// Valeur fondamentale, prix cible, PER, résultat net.
import { capi, valeurParticipations } from './acces.js';
import { IMPOT, clamp } from './config.js';
import { fixeAnnuel } from './dirigeants.js';
import { couponsAnnuels, detteTotale, ebitAnnuel, tauxEmprunt } from './finance.js';
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
export function prixCible(s, c) {
  const ebit = ebitAnnuel(c) + ANTICIPATION * (c.caPipeline || 0) * c.margeRef;
  const ve = Math.max(ebit, 0.02 * c.ca) * multiple(s, c);
  const part = valeurParticipations(s, c.id) * (estHolding(c) ? 1 - DECOTE_HOLDING : 1);
  const cp = ve - detteTotale(c) + c.cash + part;
  return Math.max(cp, 0.02 * c.ca, 0.001) / c.actions;
}
export const per = (s, c) => {
  const rn = resultatNetAnnuel(s, c);
  return rn > 0 ? capi(c) / rn : null;
};
export function resultatNetAnnuel(s, c) {
  const rb = ebitAnnuel(c) + 4 * (c.divRecus || 0) - c.dette * tauxEmprunt(s, c) - couponsAnnuels(c) - (c.ceo ? fixeAnnuel(c) : 0);
  return rb > 0 ? rb * (1 - IMPOT) : rb;
}
