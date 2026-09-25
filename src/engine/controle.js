// Règle de contrôle (50 %, ou 25 % sans autre bloc de 25 %) et chaînes de détention.
import { actives, detenteursSocietes, pct } from './acces.js';
import { JOUEUR, SEUIL_CONTROLE, nomDetenteur } from './config.js';

// ---------- CONTRÔLE ----------
// Règle : un groupe contrôle une société s'il réunit la majorité absolue des droits de vote,
// ou au moins 25 % si aucun autre bloc n'atteint 25 %. Un groupe = vous, un raider, une
// famille (noyau dur), ou une société que personne ne contrôle, avec toutes les sociétés
// qu'il contrôle en cascade. Les titres qu'une société détient sur ses propres contrôleurs
// (autocontrôle) sont privés de droit de vote.
export const SEUIL_RELATIF = 0.25;

// Groupe ultime auquel appartient un détenteur, selon une répartition du contrôle
export function groupeDe(s, h, c, ctl) {
  if (h === 'noyau') return 'noyau:' + c.id;
  if (!s.societes[h]) return h;                   // vous ou un raider
  let x = h, n = 0;
  while (ctl[x] && n < 30) {                        // remonter la chaîne jusqu'au groupe ultime
    if (!s.societes[ctl[x]]) return ctl[x];
    if (ctl[x] === x) break;
    x = ctl[x]; n++;
  }
  return x;
}
// h est-elle contrôlée, même en cascade, par la société cId ?
export function dependDe(s, h, cId, ctl, profondeur = 0, vus = new Set()) {
  if (profondeur > 12 || vus.has(h)) return false;
  vus.add(h);
  const d = s.societes[h];
  if (!d || !ctl[h]) return false;
  const g = ctl[h];
  for (const k of Object.keys(d.actionnaires)) {
    if (!s.societes[k] || !s.societes[k].active) continue;
    if (groupeDe(s, k, d, ctl) !== g && k !== g) continue;   // seuls les membres du groupe contrôlant
    if (k === cId) return true;
    if (dependDe(s, k, cId, ctl, profondeur + 1, vus)) return true;
  }
  return false;
}
// Blocs de vote d'une société (groupe -> titres), en tenant compte de variations hypothétiques
export function blocsDeVote(s, c, ctl, deltas = null) {
  const titres = { ...c.actionnaires };
  if (deltas) for (const [h, d] of Object.entries(deltas)) titres[h] = (titres[h] || 0) + d;
  const blocs = {};
  for (const [h, t] of Object.entries(titres)) {
    if (h === 'public' || !(t > 1e-9)) continue;
    const g = groupeDe(s, h, c, ctl);
    if (g === c.id) continue;                                        // autocontrôle direct
    if (s.societes[h] && dependDe(s, h, c.id, ctl)) continue;        // autocontrôle indirect
    blocs[g] = (blocs[g] || 0) + t;
  }
  return blocs;
}
export function controleurSelon(s, c, ctl, deltas = null, deltaActions = 0) {
  const blocs = Object.entries(blocsDeVote(s, c, ctl, deltas)).sort((a, b) => b[1] - a[1]);
  if (!blocs.length) return null;
  const total = c.actions + deltaActions;
  const [g, t] = blocs[0];
  const second = blocs[1] ? blocs[1][1] / total : 0;
  if (t / total >= SEUIL_CONTROLE - 1e-9) return g;
  if (t / total >= SEUIL_RELATIF - 1e-9 && second < SEUIL_RELATIF - 1e-9) return g;
  return null;
}
// Répartition du contrôle de toutes les sociétés : id -> groupe contrôlant (ou absent)
export function repartitionControle(s) {
  let ctl = {};
  const socs = actives(s);
  for (let it = 0; it < 15; it++) {
    const nouveau = {};
    let change = false;
    for (const c of socs) {
      const g = controleurSelon(s, c, ctl);
      if (g) nouveau[c.id] = g;
      if (g !== (ctl[c.id] || null)) change = true;
    }
    ctl = nouveau;
    if (!change) break;
  }
  // réduire chaque entrée au groupe ultime
  const res = {};
  for (const c of socs) if (ctl[c.id]) res[c.id] = groupeDe(s, c.id, c, ctl) === c.id ? ctl[c.id] : groupeDe(s, c.id, c, ctl);
  return res;
}
// Groupe qui contrôlerait la société après des variations hypothétiques de son capital
export function simulerControle(s, cibleId, deltas, deltaActions = 0, ctl = repartitionControle(s)) {
  const c = s.societes[cibleId];
  const g = controleurSelon(s, c, ctl, deltas, deltaActions);
  if (!g) return null;
  return s.societes[g] ? groupeDe(s, g, c, ctl) : g;
}
// Ensemble des sociétés contrôlées par un groupe (vous par défaut, ou un raider)
export function controlees(s, holder = JOUEUR, ctl = repartitionControle(s)) {
  const res = new Set();
  for (const [id, g] of Object.entries(ctl)) if (g === holder) res.add(id);
  return res;
}
// Libellé du contrôleur d'une société
export function controleurDe(s, id, ctl = repartitionControle(s)) {
  const g = ctl[id];
  if (!g) return null;
  return g;
}
export const nomGroupe = (s, g) => !g ? 'personne' : g.startsWith('noyau:') ? 'son noyau dur familial' : nomDetenteur(s, g);
// Nature du contrôle : 'majorite', 'relatif' ou null
export function natureControle(s, id, ctl = repartitionControle(s)) {
  const c = s.societes[id], g = ctl[id];
  if (!g) return null;
  const blocs = blocsDeVote(s, c, ctl);
  const t = Object.entries(blocs).filter(([k]) => k === g || (s.societes[k] && groupeDe(s, k, c, ctl) === g)).reduce((a, [, v]) => a + v, 0);
  return t / c.actions >= SEUIL_CONTROLE - 1e-9 ? 'majorite' : 'relatif';
}
// Détention effective d'un groupe (directe + via les sociétés qu'il contrôle), en fraction
export function detentionEffective(s, id, ctrl = controlees(s), holder = JOUEUR) {
  const c = s.societes[id];
  let part = pct(c, holder);
  for (const h of detenteursSocietes(s, c)) if (ctrl.has(h)) part += pct(c, h);
  return part;
}
// Sociétés situées au-dessus d'une société dans sa chaîne de contrôle (pour interdire l'autocontrôle)
export function controleursChaine(s, id) {
  const ctl = repartitionControle(s);
  const acc = new Set();
  for (const c of actives(s)) if (c.id !== id && dependDe(s, id, c.id, ctl)) acc.add(c.id);
  return acc;
}
