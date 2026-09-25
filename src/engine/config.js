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
// ---------- NIVEAUX DE JEU ----------
// Choisis au lancement et conservés dans s.reglages ; « normal » reproduit exactement le jeu de référence.
// Difficulté : votre capital de départ et la rudesse de l'environnement (coups durs, volatilité), pour tous.
export const DIFFICULTES = {
  facile:    { nom: 'Facile', libelle: 'partie facile',    capital: 40, evenements: 0.5, volatilite: 0.8, texte: '40 M€ de départ, deux fois moins de coups durs, marchés plus calmes.' },
  normal:    { nom: 'Normal', libelle: 'partie normale',    capital: 25, evenements: 1,   volatilite: 1,   texte: '25 M€ de départ, comme vos concurrents.' },
  difficile: { nom: 'Difficile', libelle: 'partie difficile', capital: 15, evenements: 1.5, volatilite: 1.2, texte: '15 M€ de départ, coups durs plus fréquents, marchés plus nerveux.' },
};
// Niveau des raiders : capital (multiple de 25 M€), erreur d'estimation (multiple de leur sigma), humeur du trimestre,
// audace (multiple de la probabilité d'OPA), trimestres sans achat, achats au plus par trimestre, zèle à restructurer
export const NIVEAUX_IA = {
  debutant:    { nom: 'Débutants',    capital: 0.6, erreur: 1.8, humeur: 0.20, audace: 0.5, sansAchat: 0.5,  achats: 1, restructure: 0.3, texte: '15 M€ chacun, se trompent souvent sur la valeur, osent peu.' },
  normal:      { nom: 'Aguerris',     capital: 1,   erreur: 1,   humeur: 0.12, audace: 1,   sansAchat: 0.25, achats: 1, restructure: 0.6, texte: '25 M€ chacun, comme vous : le jeu de référence.' },
  expert:      { nom: 'Experts',      capital: 1,   erreur: 0.5, humeur: 0.06, audace: 1.4, sansAchat: 0.1,  achats: 2, restructure: 0.9, texte: '25 M€ chacun, estiment juste, attaquent plus souvent, achètent deux blocs par trimestre.' },
  impitoyable: { nom: 'Impitoyables', capital: 1.6, erreur: 0.4, humeur: 0.05, audace: 1.6, sansAchat: 0.05, achats: 2, restructure: 1,   texte: '40 M€ chacun et le jeu des experts, en plus agressif.' },
};
export const difficulte = (s) => DIFFICULTES[s.reglages?.difficulte] || DIFFICULTES.normal;
export const niveauIA = (s) => NIVEAUX_IA[s.reglages?.niveauIA] || NIVEAUX_IA.normal;
export const RAIDER_BY_ID = Object.fromEntries(RAIDERS.map(r => [r.id, r]));
export const estRaider = (s, h) => !!(s.raiders && s.raiders[h]);
export const compte = (s, h) => h === JOUEUR ? s.joueur : s.raiders[h];
export const nomDetenteur = (s, h) => h === JOUEUR ? 'Vous' : h === 'public' ? 'Flottant' : h === 'noyau' ? 'Noyau dur' : estRaider(s, h) ? RAIDER_BY_ID[h].nom : s.societes[h].nom;
