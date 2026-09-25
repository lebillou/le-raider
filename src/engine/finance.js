// Dette, levier, notation, taux et capacité d'emprunt.
import { valeurParticipations } from './acces.js';
import { estHolding } from './secteurs.js';

// ---------- NOTATION ----------
export const NOTATIONS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'];
export const SPREADS = { AAA: 0.005, AA: 0.008, A: 0.012, BBB: 0.02, BB: 0.035, B: 0.06, CCC: 0.10 };

export const ebitAnnuel = (c) => c.ca * c.marge;
// Dette obligataire (nominal restant) et dette totale, bancaire comprise
export const detteObligataire = (c) => (c.obligations || []).reduce((a, o) => a + o.nominal, 0);
export const detteTotale = (c) => c.dette + detteObligataire(c);
export const couponsAnnuels = (c) => (c.obligations || []).reduce((a, o) => a + o.nominal * o.coupon, 0);
export function levier(c) {
  const e = ebitAnnuel(c);
  const d = detteTotale(c);
  if (d <= 0.001) return 0;
  if (e <= 0) return 99;
  return d / e;
}
// Loan-to-value d'une holding : dette rapportée à ses participations et à sa trésorerie
export function ltv(s, c) {
  const base = valeurParticipations(s, c.id) + Math.max(0, c.cash);
  const d = detteTotale(c);
  if (d <= 0.001) return 0;
  return base > 0 ? d / base : 9;
}
export function notation(c, s) {
  if (estHolding(c)) {
    const v = s ? ltv(s, c) : (detteTotale(c) > 0.001 ? 0.45 : 0);
    if (v < 0.1) return 'AA';
    if (v < 0.2) return 'A';
    if (v < 0.3) return 'BBB';
    if (v < 0.4) return 'BB';
    if (v < 0.5) return 'B';
    return 'CCC';
  }
  const l = levier(c);
  if (l < 1) return 'AAA';
  if (l < 2) return 'AA';
  if (l < 3) return 'A';
  if (l < 4) return 'BBB';
  if (l < 5) return 'BB';
  if (l < 6.5) return 'B';
  return 'CCC';
}
export const tauxEmprunt = (s, c) => s.taux + SPREADS[notation(c, s)];
export function capaciteEmprunt(c, s) {
  if (estHolding(c)) return s ? Math.max(0, 0.5 * valeurParticipations(s, c.id) - detteTotale(c)) : 0;
  const e = ebitAnnuel(c);
  return Math.max(0, Math.min(4 * e, 0.7 * c.actifs) - detteTotale(c));
}
