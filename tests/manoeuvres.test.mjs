import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier, prendreUneSociete } from './outils.mjs';

const proche = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const horsGroupe = (s) => m.actives(s).filter(c => !m.controlees(s).has(c.id));

test('une rumeur fait baisser le cours, coûte son budget et reste en mémoire de l\'AMF', () => {
  const s = m.nouvellePartie(4);
  const c = horsGroupe(s).sort((a, b) => m.capi(a) - m.capi(b))[5];
  const ap = m.apercuRumeur(s, c.id, 1);
  const s2 = m.lancerRumeur(s, c.id, 1);
  verifier(s2);
  assert.ok(ap.choc > 0 && ap.choc <= m.CHOC_RUMEUR_MAX);
  assert.ok(proche(s2.societes[c.id].prix, ap.prixApres));
  assert.ok(proche(s.joueur.cash - s2.joueur.cash, 1));
  assert.equal(s2.rumeurs.length, 1);
  // Le risque croît avec la répétition
  const ap2 = m.apercuRumeur(s2, c.id, 1);
  assert.ok(ap2.risque > ap.risque, 'une deuxième rumeur est plus risquée');
  // Plus la société est grosse, moins la rumeur porte
  const grosse = horsGroupe(s).sort((a, b) => m.capi(b) - m.capi(a))[0];
  assert.ok(m.apercuRumeur(s, grosse.id, 1).choc < ap.choc);
  assert.throws(() => m.lancerRumeur(s, c.id, 0.05), /Budget minimum/);
});

test('l\'AMF démasque ou non, selon le tirage, et la sanction est appliquée', () => {
  const s = m.nouvellePartie(4);
  const c = horsGroupe(s)[10];
  const s1 = m.lancerRumeur(s, c.id, 1);
  const sur = structuredClone(s1); sur.rumeurs[0].risque = 1;
  const jamais = structuredClone(s1); jamais.rumeurs[0].risque = 0;
  const a = m.finTrimestre(sur), b = m.finTrimestre(jamais);
  verifier(a); verifier(b);
  assert.ok(a.journal.some(e => /^L'AMF démasque/.test(e.texte)));
  assert.ok(!b.journal.some(e => /^L'AMF démasque/.test(e.texte)));
  const amende = m.amendeAMF(s1, 1);
  assert.ok(amende >= 5, 'cinq fois le budget au moins');
  // Seule la sanction distingue les deux trésoreries avant les intérêts de la clôture
  assert.ok((b.joueur.cash - b.joueur.marge) - (a.joueur.cash - a.joueur.marge) > amende * 0.9);
  // La rumeur est examinée une seule fois, puis oubliée au bout de deux ans
  let x = b;
  for (let t = 0; t < m.MEMOIRE_AMF; t++) x = m.finTrimestre(x);
  assert.equal(x.rumeurs, undefined);
  assert.throws(() => m.lancerRumeur(prendreUneSociete(5)[0], prendreUneSociete(5)[1], 1), /votre groupe/);
});

test('plainte antitrust : réservée à un concurrent contrôlé, décision au bout d\'un an', () => {
  let [s, id] = prendreUneSociete(5);
  s = m.apporterCompteCourant(s, id, 8);   // de quoi payer les avocats
  const P = s.societes[id];
  const rivales = horsGroupe(s).filter(c => c.secteur === P.secteur);
  const cible = rivales.sort((a, b) => b.ca - a.ca)[0];
  const ap = m.apercuPlainte(s, id, cible.id);
  assert.ok(ap.part > 0.2 && ap.chances > 0.2, `le leader du secteur est exposé (${ap.part})`);
  const s2 = m.porterPlainte(s, id, cible.id);
  verifier(s2);
  assert.ok(proche(P.cash - s2.societes[id].cash, ap.frais));
  assert.equal(m.procesEnCours(s2, cible.id).length, 1);
  assert.throws(() => m.porterPlainte(s2, id, cible.id), /déjà en cours/);
  const autreSecteur = horsGroupe(s).find(c => c.secteur !== P.secteur && !m.estHolding(c));
  assert.throws(() => m.porterPlainte(s, id, autreSecteur.id), /n'est pas concurrente/);
  assert.throws(() => m.porterPlainte(s, cible.id, id), /Vous ne contrôlez pas/);
  // Décision forcée dans les deux sens
  for (const [chances, attendu] of [[1, /condamne/], [0, /déboute/]]) {
    let x = structuredClone(s2); x.proces[0].chances = chances;
    for (let t = 0; t < m.DELAI_PLAINTE; t++) { assert.ok(!x.journal.some(e => /condamne|déboute/.test(e.texte)), 'pas de décision avant l\'échéance'); x = m.finTrimestre(x); verifier(x); }
    assert.ok(x.journal.some(e => attendu.test(e.texte)), `décision ${attendu}`);
    assert.equal(x.proces, undefined);
    assert.throws(() => m.porterPlainte(x, id, cible.id), /statué sur/);
  }
});
