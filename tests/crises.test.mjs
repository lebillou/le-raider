import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier } from './outils.mjs';

test('krach : tous les cours cotés perdent un quart, la panique pèse ensuite', () => {
  const s = m.nouvellePartie(3);
  const x = structuredClone(s);
  m.krach(x);
  for (const c of m.actives(s)) {
    assert.ok(Math.abs(x.societes[c.id].prix - c.prix * (1 - m.CHOC_KRACH)) < 1e-9);
    assert.ok(x.societes[c.id].sentiment < c.sentiment);
  }
  verifier(x);
});

test('bulle : un secteur enfle plusieurs trimestres, puis éclate sans préavis', () => {
  const s = structuredClone(m.nouvellePartie(3));
  m.lancerBulle(s);
  const b = { ...s.bulle };
  assert.ok(b.duree >= 4 && b.duree <= 8);
  const sec = m.actives(s).filter(c => c.secteur === b.secteur);
  const avant = sec.map(c => c.sentiment);
  let t = 0;
  while (s.bulle && t < 12) { m.evoluerBulle(s); s.tour++; t++; }
  assert.equal(s.bulle, undefined, 'la bulle a éclaté');
  assert.equal(t, b.duree + 1, 'après sa durée');
  assert.ok(s.journal.some(e => /La bulle du secteur .* éclate/.test(e.texte)));
  // Après l'éclatement, le sentiment est retombé sous son niveau de départ
  sec.forEach((c, i) => assert.ok(s.societes[c.id].sentiment < avant[i] + m.GONFLEMENT_BULLE * b.duree - m.ECLATEMENT_BULLE + 1e-9));
});

test('enquête de l\'AMF : le plus riche des raiders paie et ne lance plus d\'offre pendant un an', () => {
  let s = m.nouvellePartie(3);
  const rd = m.raiderEnquete(s);
  const fortune = m.fortune(s, rd.id);
  const x = structuredClone(s);
  m.enqueteAMF(x);
  assert.ok(m.fortune(x, rd.id) < fortune - 1.99);
  assert.ok(m.interditDOffre(x, rd.id));
  for (let t = 0; t < m.DUREE_INTERDICTION - 1; t++) {
    const tour = x.tour;
    const y = m.finTrimestre(x);
    assert.ok(!y.journal.some(e => e.tour > tour && e.acteur === rd.id && /^(OPA|OPE|Offre mixte) de/.test(e.texte) && !/battue/.test(e.texte)), 'pas d\'offre pendant l\'interdiction');
    assert.ok(!y.journal.some(e => e.tour > tour && /dépose une offre hostile/.test(e.texte) && e.acteur === rd.id));
    Object.assign(x, y);
    verifier(x);
  }
});
