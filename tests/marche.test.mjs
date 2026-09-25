import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, verifier, mediane } from './outils.mjs';

test('une graine donne toujours la même partie', () => {
  let a = m.nouvellePartie(123), b = m.nouvellePartie(123);
  for (let t = 0; t < 12; t++) { a = m.finTrimestre(a); b = m.finTrimestre(b); }
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("l'univers de départ est cohérent", () => {
  const s = m.nouvellePartie(42);
  verifier(s, 'au départ');
  assert.equal(m.actives(s).length, 50);
  for (const c of m.actives(s)) {
    const ecart = c.prix / m.prixCible(s, c);
    assert.ok(ecart > 0.6 && ecart < 1.6, `${c.nom} cote trop loin de sa valeur (${ecart.toFixed(2)})`);
  }
  // Chacun des quatre acteurs démarre avec 25 M€
  for (const h of [m.JOUEUR, ...m.RAIDERS.map(r => r.id)]) assert.ok(Math.abs(m.fortune(s, h) - 25) < 0.5, `${h} ne démarre pas à 25 M€`);
});

test('le marché passif progresse de 3 à 9 % par an, sans vague de faillites', () => {
  const rendements = [];
  for (let g = 1; g <= 12; g++) {
    let s = m.nouvellePartie(g);
    const ids = m.actives(s).map(c => c.id);
    const cap0 = ids.reduce((a, id) => a + m.capi(s.societes[id]), 0);
    for (let t = 0; t < 80; t++) { s = m.finTrimestre(s); verifier(s, `graine ${g} trimestre ${t}`); }
    const cap1 = ids.reduce((a, id) => a + (s.societes[id].active ? m.capi(s.societes[id]) : 0), 0);
    rendements.push(Math.pow(cap1 / cap0, 1 / 20) - 1);
    assert.ok(s.stats.faillites <= 3, `graine ${g} : ${s.stats.faillites} faillites`);
  }
  const med = mediane(rendements);
  assert.ok(med > 0.03 && med < 0.09, `rendement médian ${(100 * med).toFixed(1)} %`);
});

test('une partie de 50 ans va à son terme et peut être prolongée', () => {
  let s = m.nouvellePartie(9, { nbTours: 200 });
  for (let t = 0; t < 200; t++) s = m.finTrimestre(s);
  assert.equal(s.fini?.raison, 'terme');
  verifier(s, 'après 50 ans');
  s = m.prolonger(s, 10);
  assert.equal(s.nbTours, 240);
  assert.equal(s.fini, null);
});
