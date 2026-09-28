import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier } from './outils.mjs';

test('une société créée démarre sous son capital puis le dépasse une fois en régime', () => {
  for (const secteur of ['techno', 'energie', 'distrib']) {
    let valeurs = [];
    for (let g = 1; g <= 6; g++) {
      let s = m.nouvellePartie(g);
      s = m.creerSociete(s, J, { type: 'operationnelle', secteur, nom: 'Test SA', capital: 10 });
      const v0 = m.capi(s.societes.F1);
      for (let t = 0; t < 12; t++) { s = m.finTrimestre(s); verifier(s); }
      valeurs.push([v0, m.capi(s.societes.F1)]);
    }
    const debut = valeurs.reduce((a, v) => a + v[0], 0) / valeurs.length, fin = valeurs.reduce((a, v) => a + v[1], 0) / valeurs.length;
    assert.ok(debut > 7.5 && debut < 9.5, `${secteur} : valeur à la création ${debut}`);
    assert.ok(fin > debut, `${secteur} : pas de rattrapage (${debut} → ${fin})`);
  }
});

test('refus de création', () => {
  const s = m.nouvellePartie(1);
  assert.throws(() => m.creerSociete(s, J, { type: 'operationnelle', secteur: 'techno', nom: 'X', capital: 10 }), /nom/);
  assert.throws(() => m.creerSociete(s, J, { type: 'operationnelle', secteur: 'techno', nom: 'Trop Petite', capital: 3 }), /minimum/);
  assert.throws(() => m.creerSociete(s, J, { type: 'holding', nom: m.actives(s)[0].nom, capital: 5 }), /déjà/);
  assert.throws(() => m.creerSociete(s, J, { type: 'operationnelle', nom: 'Sans Secteur', capital: 10 }), /secteur/);
});

test('investir coûte immédiatement un peu de valeur et la rend à maturité', () => {
  let s = m.nouvellePartie(4);
  s = m.creerSociete(s, J, { type: 'operationnelle', secteur: 'industrie', nom: 'Usine', capital: 20 });
  for (let t = 0; t < 10; t++) s = m.finTrimestre(s);
  const c = s.societes.F1;
  const avant = m.prixCible(s, c) * c.actions;
  const montant = Math.min(4, c.cash);
  const s2 = m.investir(s, 'F1', montant);
  const apres = m.prixCible(s2, s2.societes.F1) * s2.societes.F1.actions;
  // Le marché valorise tout de suite 75 % de l'activité future, à son multiple du moment
  const facteur = m.ANTICIPATION * m.RENDEMENT_INVEST * m.multiple(s, c) / m.SECT_BY_ID.industrie.mult;
  assert.ok(Math.abs((apres - avant) - montant * (facteur - 1)) < 1e-6, `${apres - avant} contre ${montant * (facteur - 1)}`);
  // Au multiple de référence, un euro investi vaut 0,86 € tout de suite et 1,15 € à maturité
  assert.ok(m.ANTICIPATION * m.RENDEMENT_INVEST < 1 && m.RENDEMENT_INVEST > 1);
});
