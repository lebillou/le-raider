import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier, prendreUneSociete } from './outils.mjs';

const proche = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

test('une holding reçoit en apport des titres cotés, et le contrôle passe par elle', () => {
  const [s, id] = prendreUneSociete(5);
  const detenus = s.societes[id].actionnaires[J];
  const params = { type: 'holding', nom: 'Financière Test', capital: 2, titres: { [id]: detenus } };
  const ap = m.apercuCreation(s, { ...params, fondateur: J });
  assert.ok(proche(ap.valeurTitres, detenus * s.societes[id].prix));
  const s2 = m.creerSociete(s, J, params);
  verifier(s2);
  const cible = s2.societes[id], F = s2.societes.F1;
  assert.equal(cible.actionnaires[J], undefined, 'vos titres ont quitté votre portefeuille');
  assert.ok(proche(cible.actionnaires.F1, detenus), 'la holding les détient');
  assert.equal(cible.prix, s.societes[id].prix, 'apport hors marché : le cours ne bouge pas');
  assert.ok(proche(m.capi(F), ap.valeurInitiale), 'aperçu et exécution concordent');
  assert.ok(proche(F.actions, ap.capitalTotal / 10));
  const ctrl = m.controlees(s2);
  assert.ok(ctrl.has('F1') && ctrl.has(id), 'vous contrôlez la holding et, par elle, la société apportée');
  assert.ok(proche(s.joueur.cash - s.joueur.marge - (s2.joueur.cash - s2.joueur.marge), 2), 'seul le numéraire est décaissé');
  // La holding est décotée : la fortune baisse de la décote sur les titres et des frais, pas davantage
  const perte = m.fortune(s) - m.fortune(s2);
  assert.ok(perte > 0 && perte <= m.DECOTE_HOLDING * ap.valeurTitres + ap.frais + 1e-6, `perte ${perte}`);
});

test('une société d\'exploitation filialise une branche de son activité', () => {
  const [s, id] = prendreUneSociete(5);
  const A = s.societes[id];
  const capital = Math.min(2, A.cash * 0.9);
  const valeurAvant = m.prixCible(s, A) * A.actions;
  const ap = m.apercuCreation(s, { type: 'operationnelle', capital, fondateur: id, branche: 0.3 });
  const s2 = m.creerSociete(s, id, { type: 'operationnelle', nom: 'Filiale Test', capital, branche: 0.3 });
  verifier(s2);
  const A2 = s2.societes[id], F = s2.societes.F1;
  assert.equal(F.secteur, A.secteur);
  assert.ok(proche(A2.ca, 0.7 * A.ca) && proche(A2.actifs, 0.7 * A.actifs));
  assert.ok(proche(F.ca, ap.caInitial) && F.ca >= 0.3 * A.ca);
  assert.equal(F.margeRef, A.margeRef);
  assert.ok(proche(F.actionnaires[id], F.actions), 'la fondatrice détient toute la filiale');
  assert.ok(m.controlees(s2).has('F1'));
  assert.equal(A2.dette, A.dette, 'la dette reste chez la fondatrice');
  // Valeur conservée, au coût près de l'activité neuve financée par le numéraire
  const valeurApres = m.prixCible(s2, A2) * A2.actions;
  assert.ok(valeurApres <= valeurAvant + 1e-6 && valeurApres >= valeurAvant - capital - 1e-6, `${valeurAvant} → ${valeurApres}`);
});

test('refus des apports en nature', () => {
  const [s, id] = prendreUneSociete(5);
  const t = s.societes[id].actionnaires[J];
  assert.throws(() => m.creerSociete(s, J, { type: 'holding', nom: 'Trop', capital: 2, titres: { [id]: 2 * t } }), /ne détenez que/);
  assert.throws(() => m.creerSociete(s, J, { type: 'operationnelle', nom: 'Branche', capital: 5, branche: 0.2 }), /Seule une société d'exploitation/);
  assert.throws(() => m.creerSociete(s, id, { type: 'operationnelle', nom: 'Branche', capital: 1, branche: 0.6 }), /au plus 50 %/);
  assert.throws(() => m.creerSociete(s, id, { type: 'holding', nom: 'Branche', capital: 1, branche: 0.2 }), /holding ne reçoit pas/);
  assert.throws(() => m.creerSociete(s, id, { type: 'operationnelle', nom: 'Branche', capital: 0.001, branche: 0.5 }), /frais de constitution/);
  const autre = m.actives(s).find(c => !m.controlees(s).has(c.id));
  assert.throws(() => m.creerSociete(s, autre.id, { type: 'holding', nom: 'Pirate', capital: 2 }), /Vous ne contrôlez pas/);
});

test('augmentation de capital réservée : au cours, à vous ou à une de vos sociétés', () => {
  let [s, id] = prendreUneSociete(5);
  const c = s.societes[id];
  const ap = m.apercuEmission(s, id, { montant: 1.5, mode: 'reservee' });
  assert.equal(ap.prixEm, c.prix, 'pas de décote');
  assert.ok(ap.detApres > ap.detAvant, 'votre part augmente');
  const s2 = m.emettreActions(s, id, { montant: 1.5, mode: 'reservee' });
  verifier(s2);
  const c2 = s2.societes[id];
  assert.ok(proche(c2.actionnaires[J], c.actionnaires[J] + ap.n));
  assert.ok(proche((s.joueur.cash - s.joueur.marge) - (s2.joueur.cash - s2.joueur.marge), ap.brut));
  assert.ok(proche(c2.cash, c.cash + ap.brut * (1 - m.FRAIS_RESERVEE)));
  assert.ok(proche(m.detentionEffective(s2, id, m.controlees(s2)), ap.detApres));
  assert.match(s2.journal[0].texte, /réservée à vous-même/);
  // Par une autre société contrôlée
  s = m.creerSociete(s, J, { type: 'operationnelle', secteur: 'sante', nom: 'Souscriptrice', capital: 12 });
  const s3 = m.emettreActions(s, id, { montant: 1, mode: 'reservee', souscripteur: 'F1' });
  verifier(s3);
  assert.ok(s3.societes[id].actionnaires.F1 > 0);
  assert.ok(proche(s.societes.F1.cash - s3.societes.F1.cash, 1));
  // Refus : souscripteur non contrôlé, ou l'émettrice elle-même
  const autre = m.actives(s).find(x => !m.controlees(s).has(x.id));
  assert.throws(() => m.emettreActions(s, id, { montant: 1, mode: 'reservee', souscripteur: autre.id }), /souscripteur/);
  assert.throws(() => m.emettreActions(s, id, { montant: 1, mode: 'reservee', souscripteur: id }), /souscripteur/);
});

test('compte courant : prêt sans dilution, rémunéré, remboursable, transmis en cas de fusion', () => {
  let [s, id] = prendreUneSociete(5);
  const c = s.societes[id];
  const fortune = m.fortune(s), valeur = m.prixCible(s, c) * c.actions, part = c.actionnaires[J];
  let s2 = m.apporterCompteCourant(s, id, 2);
  verifier(s2);
  const c2 = s2.societes[id];
  assert.equal(m.compteCourant(c2), 2);
  assert.ok(proche(c2.cash, c.cash + 2));
  assert.equal(c2.actionnaires[J], part, 'pas de dilution');
  assert.ok(proche(m.fortune(s2), fortune), 'la trésorerie devient une créance');
  assert.ok(proche(m.prixCible(s2, c2) * c2.actions, valeur), 'la dette d\'associé compense la trésorerie reçue');
  assert.ok(proche(m.interetsComptesCourants(s2, c2), 2 * m.tauxCompteCourant(s2)));
  assert.ok(proche(m.creancesComptesCourants(s2), 2));
  // Remboursement partiel puis total
  let s3 = m.rembourserCompteCourant(s2, id, 0.5);
  assert.ok(proche(m.compteCourant(s3.societes[id]), 1.5));
  assert.ok(proche(s3.joueur.cash - s3.joueur.marge, s2.joueur.cash - s2.joueur.marge + 0.5));
  s3 = m.rembourserCompteCourant(s3, id, 99);
  assert.equal(s3.societes[id].comptesCourants, undefined);
  assert.throws(() => m.rembourserCompteCourant(s3, id, 1), /pas de compte courant/);
  const autre = m.actives(s).find(x => !m.controlees(s).has(x.id));
  assert.throws(() => m.apporterCompteCourant(s, autre.id, 1), /Vous ne contrôlez pas/);
  // Les intérêts sont versés à la clôture : la créance reste intacte
  const s4 = m.finTrimestre(s2);
  verifier(s4);
  if (s4.societes[id].active) assert.ok(proche(m.compteCourant(s4.societes[id]), 2));
  // Fusion : la créance suit l'absorbante
  let s5 = m.creerSociete(s2, J, { type: 'operationnelle', secteur: s.societes[id].secteur, nom: 'Absorbante', capital: 10 });
  s5 = m.fusionner(s5, 'F1', id);
  verifier(s5);
  assert.ok(proche(m.compteCourant(s5.societes.F1), 2));
  assert.ok(proche(m.creancesComptesCourants(s5), 2));
});
