import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier, prendreUneSociete } from './outils.mjs';

test('le mandat de PDG rapporte un fixe, des revues annuelles et des options', () => {
  let [s, id] = prendreUneSociete(5);
  s = m.prendreMandat(s, id);
  assert.throws(() => m.prendreMandat(s, id), /déjà/);
  for (let t = 0; t < 16 && s.societes[id].ceo; t++) { s = m.finTrimestre(s); verifier(s); }
  const ce = s.societes[id].ceo;
  assert.ok(ce, 'le mandat doit durer');
  assert.ok(ce.percu > 0 && s.joueur.remTotale > 0);
  assert.ok(s.journal.filter(e => /Revue annuelle de votre mandat/.test(e.texte)).length >= 3);
});

test('le fixe croît avec la taille et reste plafonné par l\'EBIT', () => {
  const c = { ca: 1000, marge: 0.1, actions: 1, prix: 100, secteur: 'industrie' };
  assert.ok(Math.abs(m.fixeAnnuel(c) - (0.1 + 0.03 * Math.sqrt(1000))) < 1e-9);
  const petite = { ca: 50, marge: 0.02, actions: 1, prix: 10, secteur: 'distrib' };
  assert.ok(m.fixeAnnuel(petite) <= Math.max(0.05, 0.08 * 50 * 0.02) + 1e-9);
});

test('au plus cinq présidences', () => {
  let s = m.nouvellePartie(9);
  s.joueur.cash = 3000;
  let pris = 0, refus = '';
  for (const c of m.actives(s).sort((a, b) => m.capi(a) - m.capi(b)).slice(0, 14)) {
    try { if (!m.apercuOPA(s, J, c.id, 0.5).prendControle) continue; s = m.lancerOPA(s, J, c.id, 0.5); s = m.prendreMandat(s, c.id); pris++; }
    catch (e) { refus = e.message; if (/cumulez/.test(refus)) break; }
  }
  assert.equal(pris, m.MANDATS_MAX);
  assert.match(refus, /cumulez/);
});

test('perdre le contrôle révoque le mandat', () => {
  let s = m.nouvellePartie(8);
  const ctl = m.repartitionControle(s);
  const c = m.actives(s).filter(x => !x.actionnaires.noyau && !ctl[x.id] && Object.keys(x.actionnaires).length === 1).sort((a, b) => m.capi(a) - m.capi(b))[2];
  s = m.acheter(s, J, c.id, m.capi(c) * 0.36);
  s = m.prendreMandat(s, c.id);
  s.raiders.R2.cash = 500;
  s = m.lancerOPA(s, 'R2', c.id, 0.4);
  s = m.finTrimestre(s);
  verifier(s);
  assert.ok(!s.societes[c.id].ceo || s.societes[c.id].ceo.h !== J);
  assert.ok(s.journal.some(e => /prend fin \(révocation/.test(e.texte)));
});
