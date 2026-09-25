import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier, prendreUneSociete } from './outils.mjs';

test('augmentation de capital avec droit préférentiel : neutre pour qui souscrit comme pour qui vend ses droits', () => {
  let [s, id] = prendreUneSociete(5);
  for (let i = 0; i < 2; i++) s = m.finTrimestre(s);
  const avant = m.fortune(s);
  for (const souscrireJoueur of [true, false]) {
    const s2 = m.emettreActions(s, id, { montant: 3, mode: 'droits', souscrireJoueur });
    verifier(s2);
    // seuls les frais d'émission (3 %) coûtent quelque chose, au prorata de la détention
    assert.ok(Math.abs(m.fortune(s2) - avant) < 0.05 * 3, `écart ${m.fortune(s2) - avant}`);
    if (souscrireJoueur) assert.ok(Math.abs(m.pct(s2.societes[id], J) - m.pct(s.societes[id], J)) < 1e-9, 'la quote-part doit être conservée');
  }
});

test('placement public : dilue, lève des fonds, une fois tous les quatre trimestres, jamais plus du double', () => {
  let [s, id] = prendreUneSociete(5);
  const cash = s.societes[id].cash, p = m.pct(s.societes[id], J);
  const s2 = m.emettreActions(s, id, { montant: 3, mode: 'public' });
  assert.ok(s2.societes[id].cash > cash + 2.8);
  assert.ok(m.pct(s2.societes[id], J) < p);
  assert.throws(() => m.emettreActions(s2, id, { montant: 1, mode: 'public' }), /récemment/);
  assert.throws(() => m.emettreActions(s, id, { montant: 1e4, mode: 'public' }), /doubler/);
});

test('placement privé : le raider décline si le prix dépasse son estimation', () => {
  const [s, id] = prendreUneSociete(5);
  const ap = m.apercuEmission(s, id, { montant: 3, mode: 'prive', investisseur: 'R1' });
  assert.ok(ap.vide || ap.repartition.R1 > 0);
});

test('obligations : capacité par type, coupon fixe, refus au-delà', () => {
  const [s, id] = prendreUneSociete(5, { filtre: c => m.ebitAnnuel(c) > 1 });
  const c = s.societes[id];
  const cl = m.capaciteObligataire(s, c, 'classique'), hy = m.capaciteObligataire(s, c, 'hy');
  assert.ok(hy > cl, 'le haut rendement va plus loin que la classique');
  assert.throws(() => m.emettreObligations(s, id, { montant: cl + 5, maturite: 5, type: 'classique' }), /ne souscriront pas/);
  const a = m.apercuObligations(s, id, { montant: cl * 0.9, maturite: 5, type: 'classique' });
  const b = m.apercuObligations(s, id, { montant: cl * 0.9, maturite: 5, type: 'hy' });
  assert.ok(b.coupon > a.coupon);
  const s2 = m.emettreObligations(s, id, { montant: cl * 0.9, maturite: 5, type: 'classique' });
  verifier(s2);
  assert.throws(() => m.emettreObligations(s2, id, { montant: 1, maturite: 5, type: 'hy' }), /ce trimestre/);
  assert.ok(Math.abs(m.detteObligataire(s2.societes[id]) - cl * 0.9) < 1e-9);
});

test('échéance : une convertible dans la monnaie est convertie en actions', () => {
  let [s, id] = prendreUneSociete(5);
  s = m.emettreObligations(s, id, { montant: 4, maturite: 5, type: 'convertible' });
  const o = s.societes[id].obligations[0];
  o.echeance = s.tour + 1;
  s.societes[id].prix = o.prixConversion * 1.4; s.societes[id].sentiment = 0.4;
  const actions = s.societes[id].actions;
  s = m.finTrimestre(s);
  verifier(s);
  assert.equal(s.societes[id].obligations.length, 0);
  assert.ok(s.societes[id].actions > actions);
});

test('échéance impossible à refinancer : défaut, les porteurs deviennent actionnaires', () => {
  let [s, id] = prendreUneSociete(5);
  s = m.emettreObligations(s, id, { montant: m.capaciteObligataire(s, s.societes[id], 'hy') * 0.95, maturite: 5, type: 'hy' });
  s = m.dividendeExceptionnel(s, id, s.societes[id].cash);
  s.societes[id].obligations[0].echeance = s.tour + 1;
  const p = m.pct(s.societes[id], J);
  s = m.finTrimestre(s);
  verifier(s);
  assert.ok(m.pct(s.societes[id], J) < p, 'votre part doit être diluée');
  assert.ok(s.journal.some(e => /^Défaut de/.test(e.texte)));
});

test('remboursement anticipé avec pénalité', () => {
  let [s, id] = prendreUneSociete(5);
  s = m.emettreObligations(s, id, { montant: 3, maturite: 7, type: 'classique' });
  const cash = s.societes[id].cash;
  s = m.rembourserObligation(s, id, s.societes[id].obligations[0].id);
  verifier(s);
  assert.ok(Math.abs(cash - s.societes[id].cash - 3 * (1 + m.PENALITE_ANTICIPE.classique)) < 1e-9);
});

test('une holding emprunte sur ses participations et subit les covenants bancaires', () => {
  let s = m.nouvellePartie(42);
  s = m.creerSociete(s, J, { type: 'holding', nom: 'Participations', capital: 20 });
  assert.equal(m.capaciteEmprunt(s.societes.F1, s), 0);
  const c = m.actives(s).filter(x => !m.estHolding(x)).sort((a, b) => m.capi(a) - m.capi(b))[3];
  s = m.acheter(s, 'F1', c.id, 15);
  assert.ok(m.capaciteEmprunt(s.societes.F1, s) > 5);
  s = m.emprunter(s, 'F1', m.capaciteEmprunt(s.societes.F1, s));
  verifier(s);
  assert.throws(() => m.investir(s, 'F1', 1), /holding/);
});
