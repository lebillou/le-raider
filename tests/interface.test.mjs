// Rendu de tous les écrans et de toutes les fenêtres à partir d'états réels, sans navigateur.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { m, J } from './outils.mjs';

let ui;
before(async () => {
  // compilé dans le cache du projet pour que React y soit résolu
  const sortie = join(process.cwd(), 'node_modules', '.cache', 'raider-tests', `ui-${process.pid}.mjs`);
  await build({
    stdin: { contents: "export { default as App } from './src/App.jsx'; export * from './src/ui/Fenetre.jsx'; export * from './src/ui/Creation.jsx'; export * from './src/ui/NouvellePartie.jsx';", resolveDir: process.cwd(), loader: 'js' },
    bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', outfile: sortie, logLevel: 'error',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
  });
  ui = await import(pathToFileURL(sortie).href);
});

const h = React.createElement;
const rendre = (el) => renderToString(el);
const contient = (html, ...attendus) => { for (const a of attendus) assert.ok(html.includes(a), `manque « ${a} »`); };

// Un état riche : holding, société créée, filiale opérationnelle avec obligations et mandat
function etatRiche() {
  let s = m.nouvellePartie(5);
  s = m.creerSociete(s, J, { type: 'holding', nom: 'Financière du Port', capital: 8 });
  s = m.creerSociete(s, J, { type: 'operationnelle', secteur: 'techno', nom: 'Ateliers Nive', capital: 6 });
  const p = m.actives(s).filter(c => !c.creePar).sort((a, b) => m.capi(a) - m.capi(b));
  const A = p.find(c => { const ap = m.apercuOPA(s, J, c.id, 0.35); return ap.prendControle && ap.cout <= s.joueur.cash + 0.5 * (m.valeurPortefeuille(s) + ap.titres * ap.prixOffre) - 1; });
  s = m.lancerOPA(s, J, A.id, 0.35);
  s = m.emettreObligations(s, A.id, { montant: Math.max(1, m.capaciteObligataire(s, s.societes[A.id], 'hy') * 0.5), maturite: 7, type: 'hy' });
  s = m.prendreMandat(s, A.id);
  for (let i = 0; i < 5; i++) s = m.finTrimestre(s);
  return { s, A: A.id };
}

test('écrans principaux', () => {
  const { s, A } = etatRiche();
  contient(rendre(h(ui.App, { initial: s })), 'La cote', 'Créer une société', 'Financière du Port', 'Clôturer le trimestre');
  contient(rendre(h(ui.App, { initial: s, ongletInitial: 'portefeuille' })), 'Votre fortune', 'Positions directes');
  contient(rendre(h(ui.App, { initial: s, ongletInitial: 'concurrents' })), 'Les concurrents', 'Consortium Lemarchand', 'Présidences');
  contient(rendre(h(ui.App, { initial: s, ongletInitial: 'journal' })), 'Tous les acteurs');
  contient(rendre(h(ui.App, { initial: s, selectionInitiale: 'F1' })), 'Actif net réévalué', 'LTV');
  if (s.societes[A].active && m.controlees(s).has(A)) contient(rendre(h(ui.App, { initial: s, selectionInitiale: A })), 'Pilotage', 'Émettre des obligations', 'Augmentation de capital');
});

test('toutes les fenêtres d\'ordre', () => {
  const { s, A } = etatRiche();
  const cible = m.controlees(s).has(A) ? A : 'F1';
  for (const type of ['acheter', 'vendre', 'opa', 'emprunter', 'rembourser', 'dividende', 'rachat', 'investir', 'ceder', 'restructurer', 'payout', 'fusion', 'emission', 'obligations', 'mandat'])
    contient(rendre(h(ui.Fenetre, { s, action: { type, cible }, onFermer() {}, onValider() {} })), 'Confirmer', 'Annuler');
  contient(rendre(h(ui.Creation, { s, onFermer() {}, onValider() {} })), 'Créer une société', 'Raison sociale');
  contient(rendre(h(ui.NouvellePartie, { onFermer() {}, onCreer() {} })), 'Durée de la partie');
});

test('bilan de fin de partie', () => {
  let { s } = etatRiche();
  for (let i = 0; i < 80 && !s.fini; i++) s = m.finTrimestre(s);
  assert.ok(s.fini);
  contient(rendre(h(ui.App, { initial: s, ongletInitial: 'bilan' })), 'Palmarès', 'Fortunes comparées', 'Chronique complète', 'Nouvelle partie');
});
