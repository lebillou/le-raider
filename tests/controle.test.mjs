import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier } from './outils.mjs';

// Une société sans noyau dur ni participation croisée, entièrement dans le public
function societeLibre(s, rang = 2) {
  const ctl = m.repartitionControle(s);
  return m.actives(s).filter(c => !c.actionnaires.noyau && !ctl[c.id] && Object.keys(c.actionnaires).length === 1)
    .sort((a, b) => m.capi(a) - m.capi(b))[rang];
}

test('25 % suffisent quand aucun autre bloc n\'atteint 25 %', () => {
  let s = m.nouvellePartie(8);
  const c = societeLibre(s);
  s = m.acheter(s, J, c.id, m.capi(c) * 0.36);
  const p = m.pct(s.societes[c.id], J);
  assert.ok(p >= 0.25 && p < 0.5, `détention ${p}`);
  assert.equal(m.repartitionControle(s)[c.id], J);
  assert.equal(m.natureControle(s, c.id), 'relatif');
});

test('un rival à 25 % fait tomber le contrôle relatif ; 50 % le rétablit', () => {
  let s = m.nouvellePartie(8);
  const c = societeLibre(s);
  s = m.acheter(s, J, c.id, m.capi(c) * 0.36);
  s = m.acheter(s, 'R2', c.id, m.capi(s.societes[c.id]) * 0.40);
  assert.ok(m.pct(s.societes[c.id], 'R2') >= 0.25);
  assert.equal(m.repartitionControle(s)[c.id], undefined, 'personne ne doit contrôler');
  s = m.acheter(s, J, c.id, (0.5 - m.pct(s.societes[c.id], J)) * m.capi(s.societes[c.id]) * 1.6);
  assert.ok(m.pct(s.societes[c.id], J) >= 0.5);
  assert.equal(m.natureControle(s, c.id), 'majorite');
  verifier(s);
});

test('un noyau dur de 25 % protège sa société', () => {
  const s = m.nouvellePartie(42);
  const ctl = m.repartitionControle(s);
  const familiales = m.actives(s).filter(c => (ctl[c.id] || '').startsWith('noyau'));
  assert.ok(familiales.length > 5);
  for (const c of familiales) assert.ok(m.pct(c, 'noyau') >= 0.25 - 1e-9);
});

test('le contrôle se transmet en cascade et l\'autocontrôle est interdit', () => {
  let s = m.nouvellePartie(5);
  s = m.creerSociete(s, J, { type: 'holding', nom: 'Mère', capital: 20 });
  const f = m.actives(s).filter(x => !x.actionnaires.noyau && !x.creePar).sort((a, b) => m.capi(a) - m.capi(b))[0];
  s = m.acheter(s, 'F1', f.id, m.capi(f) * 0.45);
  assert.equal(m.repartitionControle(s)[f.id], J, 'la filiale de la holding doit être à vous');
  assert.throws(() => m.acheter(s, f.id, 'F1', 0.5), /Autocontrôle/);
});

test('une fusion est possible dès que vous contrôlez les deux sociétés, par tout chemin', () => {
  let s = m.nouvellePartie(42);
  const p = m.actives(s).sort((a, b) => m.capi(a) - m.capi(b));
  const [B, A] = [p[0], p[1]];
  s = m.lancerOPA(s, J, A.id, 0.35);
  s = m.emprunter(s, A.id, m.capaciteEmprunt(s.societes[A.id], s));
  // ni vous ni votre filiale ne détenez 25 % seuls : c'est le cumul qui donne le contrôle
  s = m.acheter(s, A.id, B.id, Math.min(s.societes[A.id].cash, m.capi(s.societes[B.id]) * 0.18));
  s = m.acheter(s, J, B.id, m.capi(s.societes[B.id]) * 0.18);
  assert.ok(m.pct(s.societes[B.id], J) < 0.25 && m.pct(s.societes[B.id], A.id) < 0.25);
  assert.ok(m.controlees(s).has(B.id), 'contrôle conjoint vous + filiale');
  const fortune = m.fortune(s);
  s = m.fusionner(s, A.id, B.id);
  verifier(s, 'après fusion');
  assert.equal(s.societes[B.id].active, false);
  assert.ok(Math.abs(m.fortune(s) - fortune) < 1e-6, 'la fusion ne crée ni ne détruit de valeur au cours du jour');
});
