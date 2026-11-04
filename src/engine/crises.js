// Événements de marché à plusieurs temps : krach, bulle sectorielle, enquête de l'AMF sur un raider.
import { actives, fortune } from './acces.js';
import { RAIDERS, clamp } from './config.js';
import { journal } from './creation.js';
import { SECTEURS, SECT_BY_ID } from './secteurs.js';

// ---------- KRACH ----------
// Tous les cours perdent un quart d'un coup ; la panique s'installe dans le sentiment et ne se dissipe
// qu'en deux à trois ans. La valeur des sociétés, elle, n'a pas bougé : c'est le moment d'acheter, pour
// qui n'a pas été emporté par les appels de marge.
export const CHOC_KRACH = 0.25;
export function krach(s) {
  s.conj = clamp(s.conj - 0.4, -1, 1);
  for (const c of actives(s)) {
    if (c.nonCotee) continue;
    c.prix *= 1 - CHOC_KRACH;
    c.sentiment = clamp((c.sentiment || 0) - 0.25, -0.5, 0.5);
  }
}

// ---------- BULLE SECTORIELLE ----------
// Un secteur s'emballe : chaque trimestre, l'engouement pousse ses cours au-delà de leur valeur, pendant un
// à deux ans, puis la bulle éclate et les cours rechutent sous leur valeur. Rien n'annonce l'éclatement.
export const GONFLEMENT_BULLE = 0.08;    // sentiment ajouté chaque trimestre aux sociétés du secteur
export const ECLATEMENT_BULLE = 0.45;    // sentiment retiré à l'éclatement
export function lancerBulle(s) {
  const candidats = SECTEURS.filter(x => actives(s).some(c => c.secteur === x.id && !c.nonCotee));
  const sec = candidats[s.tour % candidats.length];
  s.bulle = { secteur: sec.id, depuis: s.tour, duree: 4 + (s.tour * 7) % 5 };   // de 4 à 8 trimestres
}
export const texteBulle = (s) => `Engouement pour le secteur ${SECT_BY_ID[s.bulle.secteur].nom} : les investisseurs s'y ruent, les cours s'envolent.`;
// Chaque clôture, après les événements : la bulle enfle, ou elle éclate
export function evoluerBulle(s) {
  const b = s.bulle;
  if (!b) return;
  const socs = actives(s).filter(c => c.secteur === b.secteur && !c.nonCotee);
  if (s.tour - b.depuis < b.duree) {
    for (const c of socs) c.sentiment = clamp((c.sentiment || 0) + GONFLEMENT_BULLE, -0.5, 0.5);
    return;
  }
  for (const c of socs) { c.sentiment = clamp((c.sentiment || 0) - ECLATEMENT_BULLE, -0.5, 0.5); c.prix *= 0.85; }
  journal(s, 'evenement', `La bulle du secteur ${SECT_BY_ID[b.secteur].nom} éclate : les cours s'effondrent, bien en dessous de leur valeur.`);
  delete s.bulle;
}

// ---------- ENQUÊTE DE L'AMF SUR UN RAIDER ----------
// Le plus riche des raiders actifs attire les enquêteurs : amende de 4 % de sa fortune (2 M€ au moins) et
// interdiction de lancer une offre pendant un an. Une fenêtre pour vous.
export const DUREE_INTERDICTION = 4;
export const raiderEnquete = (s) => RAIDERS.filter(r => s.raiders[r.id]?.actif).sort((a, b) => fortune(s, b.id) - fortune(s, a.id))[0] || null;
export function enqueteAMF(s) {
  const rd = raiderEnquete(s);
  if (!rd) return;
  const cp = s.raiders[rd.id];
  const amende = Math.max(2, 0.04 * Math.max(0, fortune(s, rd.id)));
  cp.cash -= amende;
  if (cp.cash < 0) { cp.marge += -cp.cash; cp.cash = 0; }
  cp.interditJusque = s.tour + DUREE_INTERDICTION;
  journal(s, 'concurrent', `L'AMF sanctionne ${rd.nom} pour manquements à l'information du marché : amende de ${amende.toFixed(1)} M€ et interdiction de lancer une offre pendant un an.`, rd.id);
}
export const interditDOffre = (s, rid) => (s.raiders[rid]?.interditJusque ?? -1) > s.tour;
