import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier } from './outils.mjs';

// Vous tenez une société en contrôle relatif (moins de 30 % du capital, aucun autre bloc), et Lemarchand y dépose une offre
function attaque() {
  let s = m.nouvellePartie(8);
  const c = m.actives(s).filter(x => Object.keys(x.actionnaires).length === 1).sort((a, b) => m.capi(a) - m.capi(b))[2];
  s = m.acheter(s, J, c.id, m.capi(c) * 0.3);
  assert.equal(m.natureControle(s, c.id), 'relatif');
  assert.ok(m.controlees(s).has(c.id));
  s.raiders.R2.cash += 500;   // de quoi payer
  s.joueur.cash += 300;
  m._deposerOffreHostile(s, 'R2', s.societes[c.id], 0.4);
  assert.ok(m.offreHostile(s, c.id));
  return [s, c.id];
}

test('sans réaction, l\'offre hostile aboutit à la clôture', () => {
  const [s, id] = attaque();
  const s2 = m.finTrimestre(s);
  verifier(s2);
  assert.equal(m.offreHostile(s2, id), null);
  assert.ok(m.controlees(s2, 'R2').has(id), 'Lemarchand prend le contrôle');
  assert.ok(!m.controlees(s2).has(id));
});

test('les bons de défense font retirer l\'offre, au prix d\'une décote', () => {
  const [s, id] = attaque();
  const multiple = m.multiple(s, s.societes[id]);
  const ap = m.apercuBons(s, id);
  const s1 = m.adopterBons(s, id);
  assert.ok(Math.abs(s.societes[id].cash - s1.societes[id].cash - ap.frais) < 1e-9);
  assert.ok(Math.abs(m.multiple(s1, s1.societes[id]) - multiple * (1 - m.DECOTE_BONS)) < 1e-9);
  assert.throws(() => m.adopterBons(s1, id), /déjà/);
  const s2 = m.finTrimestre(s1);
  verifier(s2);
  assert.ok(s2.journal.some(e => /retire son offre hostile .* bons de défense/.test(e.texte)));
  assert.ok(m.controlees(s2).has(id), 'vous gardez le contrôle');
  const s3 = m.retirerBons(s2, id);
  assert.equal(s3.societes[id].defense, undefined);
});

test('repasser à 50 % par une offre sur votre propre société fait échouer l\'assaillant', () => {
  const [s, id] = attaque();
  const s1 = m.lancerOPA(s, J, id, 0.35);
  assert.equal(m.natureControle(s1, id), 'majorite');
  const s2 = m.finTrimestre(s1);
  verifier(s2);
  assert.ok(s2.journal.some(e => /retire son offre hostile .* ne lui donnerait plus le contrôle/.test(e.texte)));
  assert.ok(m.controlees(s2).has(id));
  // Une société tenue en majorité n'est plus attaquable
  assert.ok(m.attaquable(s2, s2.societes[id]) === false || m.natureControle(s2, id) === 'majorite');
});
