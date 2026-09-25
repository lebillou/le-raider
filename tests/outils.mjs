// Outils communs aux tests du moteur.
import assert from 'node:assert/strict';
import * as m from '../src/engine/index.js';

export { m };
export const J = m.JOUEUR;

// Échoue avec le détail des invariants violés
export function verifier(s, contexte = '') {
  const e = m.verifierInvariants(s);
  assert.deepEqual(e, [], `invariants violés ${contexte} : ${e.slice(0, 3).join(' ; ')}`);
}

// Première société qu'une OPA du joueur à la prime donnée ferait passer sous son contrôle, pour un coût plafonné
export function cibleAbordable(s, { prime = 0.3, budget = 24, filtre = () => true } = {}) {
  return m.actives(s).sort((a, b) => m.capi(a) - m.capi(b)).find(c => {
    if (!filtre(c)) return false;
    const ap = m.apercuOPA(s, J, c.id, prime);
    return ap.prendControle && ap.cout <= budget;
  });
}

// Prend le contrôle d'une petite société sans recourir à la marge ; renvoie [état, id]
export function prendreUneSociete(graine = 5, options = {}) {
  let s = m.nouvellePartie(graine);
  const c = cibleAbordable(s, options);
  assert.ok(c, 'aucune cible abordable');
  s = m.lancerOPA(s, J, c.id, options.prime ?? 0.3);
  return [s, c.id];
}

export const somme = (arr) => arr.reduce((a, b) => a + b, 0);
export const mediane = (arr) => { const t = [...arr].sort((a, b) => a - b); return t[Math.floor(t.length / 2)]; };
