import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier, prendreUneSociete } from './outils.mjs';

test('une croissance tenue gagne le crédit du marché, peu à peu, et le perd si l\'on y renonce', () => {
  let [s, id] = prendreUneSociete(5);
  const multipleAvant = m.multiple(s, s.societes[id]);
  s = m.definirStrategie(s, id, { croissance: 0.05, effort: m.effortDe(s.societes[id]) });
  assert.equal(m.facteurCroissance(s.societes[id]), 1, 'aucun crédit le jour de l\'annonce');
  for (let t = 0; t < 2; t++) s = m.finTrimestre(s);
  const tot = s.societes[id].croissanceCredit;
  for (let t = 0; t < 14; t++) s = m.finTrimestre(s);
  verifier(s);
  const c = s.societes[id];
  assert.ok(tot > 0 && c.croissanceCredit > tot, 'le crédit se construit');
  assert.ok(c.croissanceCredit <= m.CREDIT_MAX + 1e-12, 'plafonné à 3 points');
  assert.ok(Math.abs(m.facteurCroissance(c) - (1 + m.CREDIT_CROISSANCE * c.croissanceCredit)) < 1e-12);
  assert.ok(multipleAvant > 0);
  if (m.controlees(s).has(id)) {
    s = m.definirStrategie(s, id, { croissance: 0, effort: m.effortDe(c) });
    const avant = s.societes[id].croissanceCredit;
    s = m.finTrimestre(s);
    if (s.societes[id].active) assert.ok((s.societes[id].croissanceCredit || 0) < avant, 'le crédit s\'érode');
  }
});

test('Vauclair vend à découvert ce qu\'il juge trop cher, dans les mêmes limites que vous', () => {
  let vu = false;
  for (let g = 1; g <= 4 && !vu; g++) {
    let s = m.nouvellePartie(g);
    for (let t = 0; t < 30; t++) {
      s = m.finTrimestre(s);
      verifier(s);
      const courtes = s.raiders.R1.courtes || {};
      assert.ok(Object.keys(courtes).length <= 3);
      if (Object.keys(courtes).length) vu = true;
      assert.equal(s.raiders.R2.courtes, undefined, 'seul Vauclair vend à découvert');
    }
  }
  assert.ok(vu, 'Vauclair n\'a jamais vendu à découvert');
});
