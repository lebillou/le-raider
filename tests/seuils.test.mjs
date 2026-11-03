import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier } from './outils.mjs';

// Société entièrement dans le public : ni noyau dur, ni participation, ni raider
function libre(s, rang = 2) {
  return m.actives(s).filter(c => Object.keys(c.actionnaires).length === 1).sort((a, b) => m.capi(a) - m.capi(b))[rang];
}

test('au-delà de 30 % du capital, l\'achat au marché cède la place à l\'offre obligatoire', () => {
  let s = m.nouvellePartie(8);
  const c = libre(s);
  const plafond = m.plafondAvantOffre(s, J, c.id);
  assert.ok(Math.abs(plafond - 0.3 * c.actions) < 1e-9);
  assert.throws(() => m.acheter(s, J, c.id, m.capi(c) * 0.5), /loi impose une offre publique/);
  s = m.acheter(s, J, c.id, m.capi(c) * 0.3);
  assert.ok(m.pct(s.societes[c.id], J) <= 0.3 + 1e-9);
  // Votre holding compte dans votre groupe
  s.joueur.cash += 50;
  s = m.creerSociete(s, J, { type: 'holding', nom: 'Groupe Test', capital: 20 });
  const reste = m.plafondAvantOffre(s, 'F1', c.id);
  assert.ok(reste < 0.3 * c.actions - m.pct(s.societes[c.id], J) * c.actions + 1e-6);
  if (reste < 1e-6) assert.throws(() => m.acheter(s, 'F1', c.id, 1), /offre publique/);
  verifier(s);
});

test('les franchissements de seuil sont publiés à la clôture, et seulement eux', () => {
  let s = m.nouvellePartie(8);
  assert.equal(s.journal.length, 1, 'une nouvelle partie n\'annonce rien');
  const c = libre(s);
  s = m.acheter(s, J, c.id, m.capi(c) * 0.04);
  s = m.finTrimestre(s);
  assert.ok(!s.journal.some(e => e.tour === s.tour && /^Vous déclarez/.test(e.texte)), 'sous 5 %, rien à déclarer');
  assert.equal(m.partDeclaree(s, c.id), 0);
  const p = m.pct(s.societes[c.id], J);
  s = m.acheter(s, J, c.id, m.capi(s.societes[c.id]) * (0.13 - p));
  s = m.finTrimestre(s);
  const d = s.journal.find(e => e.tour === s.tour && /^Vous déclarez avoir franchi à la hausse le seuil de 10 %/.test(e.texte));
  assert.ok(d, 'déclaration du seuil de 10 %');
  assert.equal(m.partDeclaree(s, c.id), 0.10);
  // Vente totale : franchissement à la baisse du plus bas seuil
  s = m.vendre(s, J, c.id, s.societes[c.id].actionnaires[J]);
  s = m.finTrimestre(s);
  assert.ok(s.journal.some(e => e.tour === s.tour && /^Vous déclarez avoir franchi à la baisse le seuil de 5 %/.test(e.texte)));
  assert.equal(m.partDeclaree(s, c.id), 0);
});

test('retrait obligatoire à 90 % : les minoritaires sont indemnisés, la société quitte la cote puis y revient', () => {
  let s = m.nouvellePartie(8);
  const c = libre(s, 0);
  s.joueur.cash += 200;
  assert.throws(() => m.retraitObligatoire(s, J, c.id), /exige 90 %/);
  s = m.lancerOPA(s, J, c.id, 1);
  const ap = m.apercuRetrait(s, c.id);
  assert.ok(ap.det >= 0.9 && ap.possible, `détention ${ap.det}`);
  assert.ok(ap.prix >= s.societes[c.id].prix - 1e-9, 'jamais sous le cours');
  const avant = s.joueur.cash - s.joueur.marge;
  const s2 = m.retraitObligatoire(s, J, c.id);
  verifier(s2);
  const c2 = s2.societes[c.id];
  assert.ok(Math.abs(c2.actionnaires[J] - c2.actions) < 1e-9, 'vous détenez tout');
  assert.ok(c2.nonCotee);
  assert.ok(Math.abs(avant - (s2.joueur.cash - s2.joueur.marge) - ap.cout) < 1e-6);
  assert.throws(() => m.lancerRumeur(s2, c.id, 1), /votre groupe|pas cotée/);
  // Hors cote, la société est évaluée à sa valeur fondamentale
  let s3 = m.finTrimestre(s2);
  verifier(s3);
  assert.ok(Math.abs(s3.societes[c.id].prix - Math.max(0.01, m.prixCible(s3, s3.societes[c.id]))) < 1e-6 || !s3.societes[c.id].nonCotee);
  // Une vente au public la ramène en bourse
  s3 = m.vendre(s3, J, c.id, s3.societes[c.id].actions * 0.2);
  s3 = m.finTrimestre(s3);
  assert.ok(!s3.societes[c.id].nonCotee);
  assert.ok(s3.journal.some(e => /revient en bourse/.test(e.texte)));
});
