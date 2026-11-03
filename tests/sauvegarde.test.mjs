import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J } from './outils.mjs';
import { CLE, exporterPartie, importerPartie } from '../src/sauvegarde.js';

test('une partie exportée se réimporte à l\'identique', () => {
  let s = m.nouvellePartie(12);
  s = m.acheter(s, J, m.actives(s)[3].id, 5);
  for (let t = 0; t < 3; t++) s = m.finTrimestre(s);
  const texte = exporterPartie(s);
  assert.equal(JSON.parse(texte).cle, CLE);
  assert.deepEqual(importerPartie(texte), s);
  assert.deepEqual(importerPartie(JSON.stringify(s)), s, 'un état brut est accepté aussi');
  // La partie réimportée se poursuit exactement comme l'originale
  assert.deepEqual(m.finTrimestre(importerPartie(texte)), m.finTrimestre(s));
});

test('refus des sauvegardes illisibles, étrangères, incompatibles ou incohérentes', () => {
  const s = m.nouvellePartie(12);
  assert.throws(() => importerPartie('pas du json'), /JSON valide/);
  assert.throws(() => importerPartie('{"bonjour": 1}'), /ne contient pas une partie/);
  assert.throws(() => importerPartie(JSON.stringify({ format: 'le-raider', cle: 'raider-partie-v1', etat: s })), /version incompatible/);
  const abime = structuredClone(s); abime.societes[abime.ordre[0]].actionnaires.public += 5;
  assert.throws(() => importerPartie(JSON.stringify(abime)), /incohérente/);
});

test('résumé de clôture : vos lignes, ce qui vous concerne, la routine des concurrents à part', () => {
  let s = m.nouvellePartie(3);
  for (let t = 0; t < 12; t++) s = m.finTrimestre(s);
  const c = m.actives(s).find(x => !m.controlees(s).has(x.id) && Object.keys(x.actionnaires).length === 1);
  const avant = m.acheter(s, J, c.id, m.capi(c) * 0.12);
  const apres = m.finTrimestre(avant);
  const r = m.resumeTrimestre(avant, apres);
  assert.equal(r.periode, m.libelleTour(avant.tour));
  assert.ok(Math.abs(r.fortuneApres - m.fortune(apres)) < 1e-9);
  assert.ok(r.lignes.some(l => l.id === c.id), 'votre nouvelle ligne figure au résumé');
  assert.ok(r.vous.some(e => /Vous déclarez avoir franchi à la hausse le seuil de 10 %/.test(e.texte)), 'votre déclaration de seuil');
  const toutes = apres.journal.filter(e => e.tour === apres.tour);
  assert.equal(r.vous.length + r.concurrents.length + r.marche.length + r.routine, toutes.length, 'chaque entrée du trimestre est classée une fois');
  assert.ok(r.concurrents.every(e => !m.estRoutine(e)));
});
