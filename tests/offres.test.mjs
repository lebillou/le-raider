import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier, prendreUneSociete } from './outils.mjs';

test('l\'aperçu d\'une OPA correspond à son exécution', () => {
  const s = m.nouvellePartie(42);
  const c = m.actives(s).sort((a, b) => m.capi(a) - m.capi(b))[0];
  const ap = m.apercuOPA(s, J, c.id, 0.35);
  const s2 = m.lancerOPA(s, J, c.id, 0.35);
  verifier(s2);
  assert.ok(Math.abs(m.pct(s2.societes[c.id], J) - ap.detApres) < 1e-9);
  assert.ok(Math.abs((s.joueur.cash - s.joueur.marge) - (s2.joueur.cash - s2.joueur.marge) - ap.cout) < 1e-6);
  assert.equal(m.repartitionControle(s2)[c.id] === J, ap.prendControle);
});

test('une offre payée en titres suppose d\'agir au nom d\'une société contrôlée', () => {
  const s = m.nouvellePartie(5);
  assert.throws(() => m.lancerOPA(s, J, m.actives(s)[0].id, 0.3, 0), /au nom d'une société que vous contrôlez/);
});

test('une OPE émet des titres de l\'initiateur et dilue ses actionnaires', () => {
  let trouve = null;
  for (let g = 1; g <= 60 && !trouve; g++) {
    let s = m.nouvellePartie(g);
    for (const A of m.actives(s).sort((a, b) => m.capi(a) - m.capi(b))) {
      const ap = m.apercuOPA(s, J, A.id, 0.35);
      if (!ap.prendControle || ap.cout > 24.5) continue;
      const s1 = m.lancerOPA(s, J, A.id, 0.35);
      for (const c of m.actives(s1)) {
        if (c.id === A.id || m.controlees(s1).has(c.id)) continue;
        const o = m.apercuOPA(s1, A.id, c.id, 0.35, 0);
        if (o.prendControle && o.garderControleInitiateur && o.cout <= s1.societes[A.id].cash) { trouve = { s: s1, A: A.id, B: c.id, o }; break; }
      }
      if (trouve) break;
    }
  }
  assert.ok(trouve, 'aucune OPE contrôlante trouvée');
  const { s, A, B, o } = trouve;
  const actions = s.societes[A].actions, fortune = m.fortune(s);
  const s2 = m.lancerOPA(s, A, B, 0.35, 0);
  verifier(s2);
  assert.ok(Math.abs(s2.societes[A].actions - actions - o.titresEmis) < 1e-9, 'titres émis');
  assert.ok(m.controlees(s2).has(B) && m.controlees(s2).has(A));
  assert.ok(Math.abs(m.fortune(s2) - fortune) < 1e-6, 'pas de décaissement du joueur');
  assert.match(s2.journal[0].texte, /^OPE de/);
});

test('un raider qui vise vos titres vous laisse apporter à son offre', () => {
  let recu = false;
  for (let g = 1; g <= 30 && !recu; g++) {
    let s = m.nouvellePartie(g);
    const c = m.actives(s).sort((a, b) => m.capi(a) - m.capi(b))[0];
    s = m.acheter(s, J, c.id, 6);
    for (let t = 0; t < 40 && !recu; t++) {
      s = m.finTrimestre(s);
      if (s.offres.find(o => o.cible === c.id)) {
        recu = true;
        const avant = s.joueur.cash;
        const s2 = m.apporterAOffre(s, c.id);
        verifier(s2);
        assert.ok(s2.joueur.cash > avant);
        assert.throws(() => m.apporterAOffre(s2, c.id), /Aucune offre/);
      }
    }
  }
  assert.ok(recu, 'aucune offre reçue');
});

test('l\'autorité de la concurrence bloque au-delà de 50 % d\'un secteur', () => {
  let s = m.nouvellePartie(3);
  s.joueur.cash = 1e6;
  let bloque = false;
  const sec = m.SECTEURS[0].id;
  for (const c of m.actives(s).filter(x => x.secteur === sec).sort((a, b) => m.capi(b) - m.capi(a))) {
    try { s = m.lancerOPA(s, J, c.id, 0.6); } catch (e) { if (/concurrence/.test(e.message)) { bloque = true; break; } }
  }
  assert.ok(bloque);
});
