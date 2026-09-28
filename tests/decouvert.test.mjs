import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier, prendreUneSociete } from './outils.mjs';

const proche = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const cibleMoyenne = (s) => m.actives(s).filter(c => !m.controlees(s).has(c.id)).sort((a, b) => m.capi(b) - m.capi(a))[15];

test('vendre à découvert : produit encaissé, cours en baisse, capital inchangé', () => {
  const s = m.nouvellePartie(6);
  const c = cibleMoyenne(s);
  const ap = m.apercuVenteDecouvert(s, c.id, 5);
  const s2 = m.vendreADecouvert(s, c.id, 5);
  verifier(s2);
  const c2 = s2.societes[c.id];
  assert.deepEqual(c2.actionnaires, c.actionnaires, 'le flottant prête et rachète : la répartition ne bouge pas');
  assert.ok(proche(c2.prix, ap.prixApres) && c2.prix < c.prix);
  assert.ok(proche(s2.joueur.cash - s.joueur.cash, ap.produit));
  assert.ok(proche(m.titresCourts(s2, c.id), ap.titres));
  assert.ok(proche(m.expositionCourte(s2), ap.titres * c2.prix));
  // Fortune : seul le coût de l'opération (impact et commission) la réduit, et elle gagne à la baisse qu'elle provoque
  assert.ok(Math.abs(m.fortune(s2) - m.fortune(s)) < 0.1 * 5);
  // Couverture : on rachète tout, le cours remonte
  const cv = m.apercuCouverture(s2, c.id, 1e9);
  const s3 = m.couvrir(s2, c.id, 1e9);
  verifier(s3);
  assert.equal(s3.joueur.courtes, undefined);
  assert.ok(s3.societes[c.id].prix > c2.prix);
  assert.ok(proche((s2.joueur.cash - s2.joueur.marge) - (s3.joueur.cash - s3.joueur.marge), cv.cout));
  assert.match(s3.journal[0].texte, /^Vous couvrez/);
});

test('refus : votre groupe, capacité, titres prêtables', () => {
  const [s, id] = prendreUneSociete(5);
  assert.throws(() => m.vendreADecouvert(s, id, 1), /délit d'initié/);
  const t = m.nouvellePartie(6);
  const c = cibleMoyenne(t);
  assert.throws(() => m.vendreADecouvert(t, c.id, m.capaciteDecouvert(t) + 5), /fortune nette|prêteurs/);
  const petite = m.actives(t).sort((a, b) => m.capi(a) - m.capi(b))[0];
  assert.throws(() => m.vendreADecouvert(t, petite.id, m.pretable(t, petite) * petite.prix + 1), /prêteurs n'ont plus|fortune nette/);
  assert.throws(() => m.couvrir(t, c.id, 1), /pas de position courte/);
  assert.throws(() => m.vendreADecouvert(t, c.id, 0.1), /minimum/);
});

test('clôture : prêt des titres et dividendes dus, appel de couverture si le cours s\'envole', () => {
  const s = m.nouvellePartie(6);
  const c = cibleMoyenne(s);
  let s2 = m.vendreADecouvert(s, c.id, 5);
  const q = m.titresCourts(s2, c.id);
  // Frais seuls, sur un état figé
  const x = structuredClone(s2); x.societes[c.id].dernierDiv = 0.5;
  const avant = x.joueur.cash - x.joueur.marge;
  m.gererDecouverts(x);
  const attendu = q * x.societes[c.id].prix * m.TAUX_PRET_TITRES / 4 + q * 0.5;
  assert.ok(proche(avant - (x.joueur.cash - x.joueur.marge), attendu));
  // Le cours triple : l'exposition dépasse 1,5 fois la fortune, le courtier fait racheter
  const y = structuredClone(s2); y.societes[c.id].prix *= 4;
  m.gererDecouverts(y);
  verifier(y);
  assert.ok(m.titresCourts(y, c.id) < q, 'position réduite');
  assert.ok(y.journal.some(e => /Appel de couverture/.test(e.texte)));
  assert.ok(m.expositionCourte(y) <= m.APPEL_DECOUVERT * Math.max(0, m.fortune(y)) + 1e-6 || !y.joueur.courtes);
  // Une vraie clôture se passe sans erreur
  s2 = m.finTrimestre(s2);
  verifier(s2);
});

test('faillite : la position se solde sans rachat ; absorption : conversion à la parité', () => {
  const s = m.nouvellePartie(6);
  const c = cibleMoyenne(s);
  const s2 = m.vendreADecouvert(s, c.id, 3);
  const q = m.titresCourts(s2, c.id);
  const x = structuredClone(s2);
  x.societes[c.id].dette = 100 * (x.societes[c.id].actifs + x.societes[c.id].cash + 10);   // insolvable
  const f = m.finTrimestre(x);
  verifier(f);
  assert.equal(f.societes[c.id].active, false);
  assert.equal(f.joueur.courtes, undefined);
  assert.ok(f.journal.some(e => /solde votre vente à découvert/.test(e.texte)));
  // Absorption : une position sur B devient une position sur A, à la parité des cours
  let [t, idA] = prendreUneSociete(5);
  t = m.creerSociete(t, J, { type: 'operationnelle', secteur: t.societes[idA].secteur, nom: 'Absorbée Test', capital: 10 });
  t.joueur.courtes = { F1: { titres: 0.1, prixMoyen: t.societes.F1.prix } };   // position antérieure à la prise de contrôle
  const ratio = t.societes.F1.prix / t.societes[idA].prix;
  const u = m.fusionner(t, idA, 'F1');
  verifier(u);
  assert.ok(proche(m.titresCourts(u, idA), 0.1 * ratio));
});
