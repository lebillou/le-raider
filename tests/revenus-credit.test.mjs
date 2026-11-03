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

test('vos dividendes et intérêts sont prélevés à 30 % ; ceux d\'une société ou d\'un raider, non', () => {
  let [s, id] = prendreUneSociete(5);
  const sansImpot = m.dividendeExceptionnel(s, id, 0.5);
  assert.ok(!sansImpot.joueur.impotsRevenus, 'sans l\'option, aucun prélèvement');
  s.reglages = { ...s.reglages, fiscalite: true };
  s = m.creerSociete(s, J, { type: 'holding', nom: 'Holding Fiscale', capital: 5 });
  const c = s.societes[id];
  const montant = Math.min(1, c.cash * 0.5);
  const s2 = m.dividendeExceptionnel(s, id, montant);
  verifier(s2);
  const recu = (s2.joueur.cash - s2.joueur.marge) - (s.joueur.cash - s.joueur.marge);
  assert.ok(Math.abs(recu - montant * m.pct(c, J) * (1 - m.IMPOT_DIVIDENDES)) < 1e-9);
  assert.ok(Math.abs(s2.joueur.impotsRevenus - montant * m.pct(c, J) * m.IMPOT_DIVIDENDES) < 1e-9);
  for (const [h, t] of Object.entries(c.actionnaires)) {
    const part = montant * t / c.actions;
    if (s.societes[h]) assert.ok(Math.abs(s2.societes[h].cash - s.societes[h].cash - part) < 1e-9, 'une société reçoit le brut');
    if (s.raiders[h]) assert.ok(Math.abs((s2.raiders[h].cash - s2.raiders[h].marge) - (s.raiders[h].cash - s.raiders[h].marge) - part) < 1e-9, 'un raider reçoit le brut');
  }
  assert.equal(m.netDeRevenu(s, J, 10), 10 * (1 - m.IMPOT_DIVIDENDES));
  assert.equal(m.netDeRevenu(s, 'F1', 10), 10);
  assert.equal(m.nouvellePartie(3, { fiscalite: true }).reglages.fiscalite, true);
});
