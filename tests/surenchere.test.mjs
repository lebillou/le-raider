import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier } from './outils.mjs';

// Première offre du joueur qu'un raider viendrait surenchérir
function offreContestee() {
  for (let g = 1; g <= 40; g++) {
    let s = m.nouvellePartie(g);
    s.joueur.cash += 300;
    for (const c of m.actives(s).sort((a, b) => m.capi(a) - m.capi(b)).slice(0, 25)) {
      for (const p of [0.1, 0.15, 0.2, 0.25, 0.3]) {
        const ap = m.apercuOPA(s, J, c.id, p);
        if (ap.titres > 0 && ap.surenchere) return { s, c, p, ap };
      }
    }
  }
  return null;
}

test('une offre trop basse est battue par la surenchère d\'un raider', () => {
  const x = offreContestee();
  assert.ok(x, 'aucune offre contestée trouvée');
  const { s, c, p, ap } = x;
  const sr = ap.surenchere;
  assert.ok(sr.prixOffre > ap.prixOffre && sr.estimation >= ap.prixOffre * (1 + m.MARGE_SURENCHERE));
  const s2 = m.lancerOPA(s, J, c.id, p);
  verifier(s2);
  assert.ok(Math.abs((s2.societes[c.id].actionnaires[J] || 0) - (s.societes[c.id].actionnaires[J] || 0)) < 1e-9, 'vous n\'obtenez aucun titre');
  assert.ok(m.controlees(s2, sr.rid).has(c.id), 'le raider prend le contrôle');
  const frais = m.FRAIS_OFFRE_CADUQUE * ap.valeur;
  assert.ok(Math.abs((s.joueur.cash - s.joueur.marge) - (s2.joueur.cash - s2.joueur.marge) - frais) < 1e-6, 'seuls les frais sont perdus');
  assert.ok(s2.journal.some(e => /battue : .* surenchérit/.test(e.texte)));
  assert.ok(s2.journal.some(e => /en surenchère/.test(e.texte)));
  // Une prime dissuasive décourage le rival
  const pd = m.primeDissuasive(s, J, c.id);
  assert.ok(pd > p);
  const ap2 = m.apercuOPA(s, J, c.id, Math.min(1.5, pd));
  assert.equal(ap2.surenchere, null);
});

test('le coût d\'une restructuration est proportionné à ce qu\'elle rapporte, dans tous les secteurs', () => {
  const s = m.nouvellePartie(4);
  for (const c of m.actives(s).filter(x => !m.estHolding(x))) {
    const gain = (m.margeApresRestructuration(c) - c.margeRef) * c.ca * m.SECT_BY_ID[c.secteur].mult;
    const cout = m.coutRestructuration(c);
    assert.ok(cout >= m.COUT_MIN_RESTRUCTURATION * c.ca - 1e-9);
    if (cout > m.COUT_MIN_RESTRUCTURATION * c.ca + 1e-9) assert.ok(Math.abs(gain / cout - m.RENDEMENT_RESTRUCTURATION) < 1e-9, `${c.nom} : ${gain / cout}`);
  }
});
