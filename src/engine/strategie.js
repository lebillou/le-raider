// Stratégie opérationnelle des sociétés d'exploitation : croissance visée et budget de R&D ou de marketing.
import { IMPOT, JOUEUR, clamp } from './config.js';
import { MONTEE_EN_CHARGE, journal } from './creation.js';
import { filiale } from './pilotage.js';
import { SECT_BY_ID, estHolding } from './secteurs.js';
import { cloner } from './transactions.js';

// ---------- STRATÉGIE OPÉRATIONNELLE ----------
// Deux leviers, fixés par qui contrôle la société et appliqués à chaque clôture :
// - la croissance visée, en points de croissance annuelle du CA au-delà du rythme du secteur.
//   Gagner des parts de marché coûte de la marge (prix, force de vente) ; y renoncer en libère.
// - le budget de R&D (industrie, énergie, technologie, santé) ou de marketing (les autres secteurs),
//   en part du CA. Le budget habituel du secteur est déjà compris dans la marge de référence :
//   dépenser plus coûte tout de suite et relève la marge cible avec retard ; couper gonfle le résultat
//   publié mais érode la marge cible.
// Le marché regarde au travers : il valorise l'EBIT avant ces charges (ebitNormatif) et ne récompense
// que leurs effets. Les banques, les agences de notation et le bonus du PDG voient l'EBIT publié.
export const CROISSANCE_MIN = -0.04;
export const CROISSANCE_MAX = 0.08;
export const EFFORT_SUP = 0.08;              // budget maximal : habituel + 8 points de CA
// Valeur créée par euro dépensé (après impôt) à faible dose ; les rendements décroissent ensuite
export const RENDEMENT_CROISSANCE = 1.5;
export const SATURATION_CROISSANCE = 0.06;   // à +6 points, chaque point coûte deux fois plus cher
export const RENDEMENT_EFFORT = 2.0;
export const SATURATION_EFFORT = 0.08;       // à +8 points de budget, l'efficacité marginale est divisée par quatre
// Part de l'effet en attente qui passe dans la marge cible chaque trimestre : la R&D mûrit en trois ans environ,
// une campagne de marketing en un an
export const DIFFUSION = { rd: 0.08, marketing: 0.25 };
export const PLANCHER_MARGE = 0.3;           // marge cible minimale, en fraction de la marge du secteur
export const PLAFOND_MARGE = 1.6;            // commun avec la restructuration
export const LIBELLE_EFFORT = { rd: 'R&D', marketing: 'marketing' };
export const HORIZON_STRATEGIE = 20;         // trimestres projetés dans l'aperçu

export const parametresEffort = (c) => SECT_BY_ID[c.secteur]?.effort || null;
export const effortDe = (c) => { const p = parametresEffort(c); return p ? (c.effort ?? p.norme) : 0; };
export const effortMax = (c) => { const p = parametresEffort(c); return p ? p.norme + EFFORT_SUP : 0; };
export const croissanceDe = (c) => parametresEffort(c) ? (c.croissanceVisee ?? 0) : 0;
// Croissance tendancielle du secteur, qui s'érode avec la taille : un géant finit par croître comme l'économie
export const croissanceSecteur = (c) => { const sec = SECT_BY_ID[c.secteur]; return 0.02 + (sec.g - 0.02) * Math.exp(-c.ca / 8000); };
// Un géant gagne difficilement des parts de marché : l'effort commercial y porte moins
export const facteurTaille = (ca) => 0.4 + 0.6 * Math.exp(-Math.max(0, ca) / 8000);

// Coût annuel, en part du CA, d'une croissance supplémentaire dg ; négatif quand dg < 0 (économie réalisée).
// Calibré sur la valeur d'un point de CA au multiple du secteur : rentable à petite dose, ruineux à forte dose ;
// sacrifier la croissance rapporte toujours moins que ce qu'elle vaut.
export function coutCroissance(c, dg = croissanceDe(c)) {
  if (!dg) return 0;
  const sec = SECT_BY_ID[c.secteur];
  const base = Math.abs(dg) * Math.max(c.margeRef ?? sec.marge, 0.2 * sec.marge) * sec.mult / (RENDEMENT_CROISSANCE * (1 - IMPOT));
  return dg > 0 ? base * (1 + dg / SATURATION_CROISSANCE) : -base * (1 - Math.abs(dg) / (2 * Math.abs(CROISSANCE_MIN)));
}
// Charges discrétionnaires en part du CA, par rapport à la gestion habituelle du secteur (négatives si l'on coupe)
export function chargeStrategique(c) {
  const p = parametresEffort(c);
  return p ? effortDe(c) - p.norme + coutCroissance(c) : 0;
}

// Un trimestre de stratégie : croissance supplémentaire du CA, effets de l'effort qui mûrissent dans la marge cible.
// N'utilise aucun aléa : l'aperçu la rejoue telle quelle.
export function evolutionStrategique(c) {
  const p = parametresEffort(c);
  if (!p) return;
  const dg = croissanceDe(c);
  const x = effortDe(c) - p.norme;
  let latente = c.margeLatente || 0;
  if (!dg && Math.abs(x) < 1e-9 && !latente) return;
  const sec = SECT_BY_ID[c.secteur];
  if (dg) c.ca *= 1 + dg * facteurTaille(c.ca) / 4;
  const plafond = PLAFOND_MARGE * sec.marge, plancher = PLANCHER_MARGE * sec.marge;
  if (Math.abs(x) >= 1e-9) {
    const unitaire = p.efficacite * RENDEMENT_EFFORT * (1 - IMPOT) / sec.mult / 4;
    if (x > 0) {
      // Plus la marge visée approche du plafond du secteur, moins l'effort rapporte
      const saturation = clamp((plafond - c.margeRef - latente) / (plafond - sec.marge), 0, 1.5);
      latente += unitaire * x / (1 + x / SATURATION_EFFORT) * saturation;
    } else latente += unitaire * x;
  }
  if (Math.abs(latente) > 1e-7) {
    const d = latente * DIFFUSION[p.nature];
    c.margeRef = clamp(c.margeRef + d, Math.min(plancher, c.margeRef), Math.max(plafond, c.margeRef));
    latente -= d;
  } else latente = 0;
  c.margeLatente = latente;
}

export function verifierStrategie(c, { croissance, effort }) {
  const p = parametresEffort(c);
  if (estHolding(c) || !p) throw new Error(`${c.nom} est une holding : elle n'a ni exploitation ni budget de ${LIBELLE_EFFORT.rd} ou de marketing.`);
  if (!Number.isFinite(croissance) || croissance < CROISSANCE_MIN - 1e-9 || croissance > CROISSANCE_MAX + 1e-9)
    throw new Error(`Croissance visée entre ${Math.round(100 * CROISSANCE_MIN)} et +${Math.round(100 * CROISSANCE_MAX)} points par an.`);
  if (!Number.isFinite(effort) || effort < -1e-9 || effort > effortMax(c) + 1e-9)
    throw new Error(`Budget de ${LIBELLE_EFFORT[p.nature]} entre 0 et ${(100 * effortMax(c)).toFixed(1)} % du chiffre d'affaires.`);
  return { croissance: clamp(croissance, CROISSANCE_MIN, CROISSANCE_MAX), effort: clamp(effort, 0, effortMax(c)) };
}

// Projection sans aléa ni conjoncture, pour comparer deux politiques dans l'aperçu
export function projeterStrategie(c0, { croissance, effort }, trimestres = HORIZON_STRATEGIE) {
  const c = { secteur: c0.secteur, ca: c0.ca, marge: c0.marge, margeRef: c0.margeRef, margeLatente: c0.margeLatente || 0, caPipeline: c0.caPipeline || 0, effort, croissanceVisee: croissance };
  let charges = 0;
  for (let t = 0; t < trimestres; t++) {
    c.ca *= 1 + croissanceSecteur(c) / 4;
    evolutionStrategique(c);
    if (c.caPipeline > 0.01) { const d = c.caPipeline * MONTEE_EN_CHARGE; c.ca += d; c.caPipeline -= d; }
    c.marge += 0.25 * (c.margeRef - c.marge);
    charges += chargeStrategique(c) * c.ca / 4;
  }
  const charge = chargeStrategique(c);
  return { ca: c.ca, marge: c.marge, margeCible: c.margeRef + c.margeLatente, ebitNormatif: c.ca * c.marge, ebitPublie: c.ca * (c.marge - charge), charges };
}

export function apercuStrategie(s, id, politique) {
  const c = s.societes[id];
  const pol = verifierStrategie(c, politique);
  const p = parametresEffort(c);
  const avant = { croissance: croissanceDe(c), effort: effortDe(c) };
  const apres = { ...c, croissanceVisee: pol.croissance, effort: pol.effort };
  const tauxAvant = chargeStrategique(c), tauxApres = chargeStrategique(apres);
  return {
    ...pol, nature: p.nature, norme: p.norme, effortMax: effortMax(c), efficacite: p.efficacite,
    chargeAvant: tauxAvant * c.ca, chargeApres: tauxApres * c.ca,
    margePublieeAvant: c.marge - tauxAvant, margePublieeApres: c.marge - tauxApres,
    ebitPublieAvant: c.ca * (c.marge - tauxAvant), ebitPublieApres: c.ca * (c.marge - tauxApres),
    ans: HORIZON_STRATEGIE / 4,
    actuelle: projeterStrategie(c, avant), nouvelle: projeterStrategie(c, pol),
  };
}

export function definirStrategie(s0, id, politique) {
  const s = cloner(s0); const c = filiale(s, id);
  _definirStrategie(s, c, verifierStrategie(c, politique), 'filiale', JOUEUR);
  return s;
}
export function _definirStrategie(s, c, { croissance, effort }, type, acteur = JOUEUR) {
  const p = parametresEffort(c);
  c.croissanceVisee = croissance;
  c.effort = effort;
  const pts = (v) => `${v > 0 ? '+' : ''}${(100 * v).toFixed(1).replace('.', ',')}`;
  journal(s, type, `${c.nom} revoit sa stratégie : croissance visée ${pts(croissance)} points par an par rapport au secteur, budget de ${LIBELLE_EFFORT[p.nature]} à ${(100 * effort).toFixed(1).replace('.', ',')} % du CA (habituel ${(100 * p.norme).toFixed(1).replace('.', ',')} %).`, acteur);
}
