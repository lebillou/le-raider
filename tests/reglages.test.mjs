import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier } from './outils.mjs';

test('les réglages normaux sont ceux par défaut, et un réglage inconnu retombe sur la normale', () => {
  const a = m.nouvellePartie(9), b = m.nouvellePartie(9, { difficulte: 'normal', niveauIA: 'normal' }), c = m.nouvellePartie(9, { difficulte: 'extreme', niveauIA: '?' });
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  assert.deepEqual(a.reglages, { difficulte: 'normal', niveauIA: 'normal' });
  assert.equal(a.joueur.cash, 25);
  // Une ancienne sauvegarde, sans réglages, se joue au niveau normal
  const ancienne = structuredClone(a); delete ancienne.reglages;
  assert.equal(m.difficulte(ancienne), m.DIFFICULTES.normal);
  assert.equal(m.niveauIA(ancienne), m.NIVEAUX_IA.normal);
  assert.deepEqual(m.finTrimestre(ancienne).societes, m.finTrimestre(a).societes);
});

test('capital de départ selon la difficulté et le niveau des concurrents', () => {
  for (const [dif, capital] of [['facile', 40], ['difficile', 15]]) {
    const s = m.nouvellePartie(3, { difficulte: dif });
    assert.equal(s.joueur.cash, capital);
    assert.deepEqual(s.joueur.histFortune, [capital]);
    verifier(s);
  }
  for (const [niv, capital] of [['debutant', 15], ['expert', 25], ['impitoyable', 40]]) {
    const s = m.nouvellePartie(3, { niveauIA: niv });
    for (const r of m.RAIDERS) assert.ok(Math.abs(m.fortune(s, r.id) - capital) < 1e-6, `${niv} ${r.id} : ${m.fortune(s, r.id)}`);
    assert.match(s.journal[s.journal.length - 1].texte, new RegExp(`concurrents ${m.NIVEAUX_IA[niv].nom.toLowerCase()}`));
  }
});

test('une partie difficile connaît plus de coups durs qu\'une partie facile', () => {
  const durs = /^Crise de confiance|^Scandale|^Grève|relève ses taux|^Retournement immobilier/;
  const compter = (dif) => {
    let n = 0;
    for (let g = 1; g <= 3; g++) {
      let s = m.nouvellePartie(g, { difficulte: dif, nbTours: 24 });
      for (let t = 0; t < 24; t++) s = m.finTrimestre(s);
      verifier(s);
      n += s.journal.filter(e => durs.test(e.texte)).length;
    }
    return n;
  };
  const facile = compter('facile'), difficile = compter('difficile');
  assert.ok(difficile > facile, `difficile ${difficile}, facile ${facile}`);
});
