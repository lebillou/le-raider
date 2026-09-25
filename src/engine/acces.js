// Accès à l'état : sociétés actives, capitalisation, détentions, fortune.
import { JOUEUR, compte, estRaider } from './config.js';

// ---------- ACCÈS ----------
export const societe = (s, id) => {
  const c = s.societes[id];
  if (!c || !c.active) throw new Error('Société inconnue ou disparue');
  return c;
};
export const actives = (s) => s.ordre.map(id => s.societes[id]).filter(c => c.active);
export const capi = (c) => c.actions * c.prix;
export const pct = (c, holder) => (c.actionnaires[holder] || 0) / c.actions;
export const flottant = (c) => c.actionnaires.public || 0;

// Valeur de marché des participations détenues par un acteur (M€)
export function valeurParticipations(s, holder) {
  let v = 0;
  for (const c of actives(s)) v += (c.actionnaires[holder] || 0) * c.prix;
  return v;
}
export const valeurPortefeuille = (s) => valeurParticipations(s, JOUEUR);
// Fortune nette : trésorerie, titres au cours et avances en compte courant, moins la dette sur marge
export function fortune(s, h = JOUEUR) {
  let cc = 0;
  for (const c of actives(s)) cc += c.comptesCourants?.[h] || 0;
  return compte(s, h).cash - compte(s, h).marge + valeurParticipations(s, h) + cc;
}

// Détenteurs d'une société, hors public et noyau, qui sont des sociétés
export const detenteursSocietes = (s, c) => Object.keys(c.actionnaires).filter(h => h !== 'public' && h !== 'noyau' && h !== JOUEUR && !estRaider(s, h));
