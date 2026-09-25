// Constantes du jeu et définition des acteurs (joueur, raiders).

// ============================================================
//  MOTEUR — "Le Raider"
//  Simulation boursière et capitalistique inspirée de Wall Street Raider.
//  Unités : montants en M€, actions en millions de titres, prix en €.
//  Invariant : capitalisation (M€) = actions (M) × prix (€).
//  Toutes les fonctions publiques sont pures : elles clonent l'état,
//  le modifient, et le renvoient. Les refus lèvent une Error à message
//  lisible, destinée à l'interface.
// ============================================================

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const JOUEUR = 'J';
export const NB_TOURS = 80;           // 20 ans, pas trimestriel
export const IMPOT = 0.25;
export const COMMISSION = 0.002;      // frais de courtage
export const FRAIS_OPA = 0.01;        // banques conseil
export const IMPACT = 1.5;            // acheter 10 % du capital déplace le prix de 15 %
export const SEUIL_CONTROLE = 0.5;
export const MARGE_MAX = 0.5;         // dette sur marge ≤ 50 % du portefeuille
export const MARGE_APPEL = 0.6;
export const ANTITRUST = 0.5;         // part de CA sectoriel contrôlée au-delà de laquelle une prise de contrôle est bloquée
export const PRIME_NOYAU = 0.30;      // le noyau dur ne cède qu'à partir de 30 % de prime

// ---------- RAIDERS CONCURRENTS ----------
// seuilApport : prime à partir de laquelle ils apportent leurs titres à une offre adverse
export const RAIDERS = [
  { id: 'R1', nom: 'Groupe Vauclair', style: 'valeur', cash: 25, margeMax: 0, seuilApport: 0.15, sigma: 0.18, pOpa: 0.08, primeMax: 0.30, levierMax: 2, payout: 0.5, surcoteMax: 0.95,
    devise: 'Achète décoté, vend cher, refuse la dette.' },
  { id: 'R2', nom: 'Consortium Lemarchand', style: 'raider', cash: 25, margeMax: 0.4, seuilApport: 0.25, sigma: 0.30, pOpa: 0.30, primeMax: 0.45, levierMax: 3.5, payout: 0.8, surcoteMax: 1.15,
    devise: 'Prend le contrôle, endette, distribue.' },
  { id: 'R3', nom: 'Fonds Meridian', style: 'opportuniste', cash: 25, margeMax: 0.3, seuilApport: 0.18, sigma: 0.24, pOpa: 0.18, primeMax: 0.40, levierMax: 2.5, payout: 0.6, surcoteMax: 1.05,
    devise: 'Se glisse dans les capitaux convoités et revend au plus offrant.' },
];
export const RAIDER_BY_ID = Object.fromEntries(RAIDERS.map(r => [r.id, r]));
export const estRaider = (s, h) => !!(s.raiders && s.raiders[h]);
export const compte = (s, h) => h === JOUEUR ? s.joueur : s.raiders[h];
export const nomDetenteur = (s, h) => h === JOUEUR ? 'Vous' : h === 'public' ? 'Flottant' : h === 'noyau' ? 'Noyau dur' : estRaider(s, h) ? RAIDER_BY_ID[h].nom : s.societes[h].nom;
