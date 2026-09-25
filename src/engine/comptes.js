// Comptes courants d'associé : le joueur prête à une société qu'il contrôle, sans dilution.
import { JOUEUR } from './config.js';
import { journal } from './creation.js';
import { filiale } from './pilotage.js';
import { cloner, crediter, debiter } from './transactions.js';

// ---------- COMPTES COURANTS D'ASSOCIÉ ----------
// Une avance d'actionnaire : elle finance la société sans émettre d'actions, porte intérêt au taux
// directeur + 2 points (charge déductible) et se rembourse quand la trésorerie le permet.
// Subordonnée, elle ne compte ni dans le levier ni dans la notation, mais le marché la déduit de la
// valeur des actions ; en cas de liquidation, elle est perdue.
export const PRIME_COMPTE_COURANT = 0.02;
export const tauxCompteCourant = (s) => s.taux + PRIME_COMPTE_COURANT;
export const compteCourant = (c, h = JOUEUR) => c.comptesCourants?.[h] || 0;
export const totalComptesCourants = (c) => Object.values(c.comptesCourants || {}).reduce((a, b) => a + b, 0);
export const interetsComptesCourants = (s, c) => totalComptesCourants(c) * tauxCompteCourant(s);
// Créances en compte courant d'un acteur sur les sociétés actives
export function creancesComptesCourants(s, h = JOUEUR) {
  let v = 0;
  for (const id of s.ordre) { const c = s.societes[id]; if (c.active) v += c.comptesCourants?.[h] || 0; }
  return v;
}

export function apporterCompteCourant(s0, id, montant) {
  if (!(montant > 0)) throw new Error('Montant invalide');
  const s = cloner(s0); const c = filiale(s, id);
  debiter(s, JOUEUR, montant);
  c.cash += montant;
  c.comptesCourants = { ...(c.comptesCourants || {}), [JOUEUR]: compteCourant(c) + montant };
  journal(s, 'filiale', `Vous avancez ${montant.toFixed(1)} M€ en compte courant à ${c.nom}, rémunérés à ${(100 * tauxCompteCourant(s)).toFixed(2).replace('.', ',')} % ; votre créance atteint ${compteCourant(c).toFixed(1)} M€.`, JOUEUR);
  return s;
}
export function rembourserCompteCourant(s0, id, montant) {
  if (!(montant > 0)) throw new Error('Montant invalide');
  const s = cloner(s0); const c = filiale(s, id);
  const du = compteCourant(c);
  if (du <= 1e-9) throw new Error(`Vous n'avez pas de compte courant chez ${c.nom}.`);
  const m = Math.min(montant, du);
  if (m > c.cash + 1e-9) throw new Error(`${c.nom} n'a que ${c.cash.toFixed(1)} M€ de trésorerie.`);
  c.cash -= m;
  if (du - m > 1e-9) c.comptesCourants[JOUEUR] = du - m;
  else { delete c.comptesCourants[JOUEUR]; if (!Object.keys(c.comptesCourants).length) delete c.comptesCourants; }
  crediter(s, JOUEUR, m);
  journal(s, 'filiale', `${c.nom} vous rembourse ${m.toFixed(1)} M€ de compte courant ; reste dû ${Math.max(0, du - m).toFixed(1)} M€.`, JOUEUR);
  return s;
}
