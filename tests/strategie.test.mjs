import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier, prendreUneSociete } from './outils.mjs';

// Une société de technologie créée par le joueur : contrôlée d'emblée, sans raider au capital
function startup(graine = 7) {
  const s = m.creerSociete(m.nouvellePartie(graine), J, { type: 'operationnelle', secteur: 'techno', nom: 'Cortexia', capital: 20 });
  return [s, 'F1'];
}
// Joue n trimestres en réappliquant la même politique (au cas où une IA la modifierait)
function jouer(s, id, n, politique) {
  for (let i = 0; i < n && !s.fini; i++) {
    if (politique && m.controlees(s).has(id)) s = m.definirStrategie(s, id, politique);
    s = m.finTrimestre(s);
  }
  return s;
}

test('sans stratégie, l\'EBIT publié est l\'EBIT d\'exploitation', () => {
  const s = m.nouvellePartie(3);
  for (const c of m.actives(s)) {
    assert.equal(m.chargeStrategique(c), 0);
    assert.equal(m.ebitAnnuel(c), m.ebitNormatif(c));
  }
});

test('l\'aperçu d\'une stratégie correspond à son exécution', () => {
  const [s, id] = prendreUneSociete(5);
  const c = s.societes[id];
  const pe = m.parametresEffort(c);
  const pol = { croissance: 0.02, effort: pe.norme + 0.03 };
  const ap = m.apercuStrategie(s, id, pol);
  const s2 = m.definirStrategie(s, id, pol);
  verifier(s2);
  const c2 = s2.societes[id];
  assert.equal(c2.croissanceVisee, 0.02);
  assert.ok(Math.abs(m.chargeStrategique(c2) * c2.ca - ap.chargeApres) < 1e-9);
  assert.ok(Math.abs(m.ebitAnnuel(c2) - ap.ebitPublieApres) < 1e-9);
  assert.ok(ap.chargeApres > ap.chargeAvant, 'croître et investir coûte');
  assert.ok(ap.nouvelle.ca > ap.actuelle.ca && ap.nouvelle.margeCible > ap.actuelle.margeCible);
  assert.match(s2.journal[0].texte, /revoit sa stratégie/);
  // Le marché capitalise l'EBIT normatif : la charge ne fait pas baisser le prix cible
  assert.ok(Math.abs(m.prixCible(s2, c2) - m.prixCible(s, c)) < 1e-9);
});

test('refus : société non contrôlée, holding, bornes', () => {
  const s = m.nouvellePartie(5);
  const autre = m.actives(s)[0];
  assert.throws(() => m.definirStrategie(s, autre.id, { croissance: 0, effort: 0.05 }), /Vous ne contrôlez pas/);
  const h = m.creerSociete(s, J, { type: 'holding', nom: 'Holding Test', capital: 5 });
  assert.throws(() => m.definirStrategie(h, 'F1', { croissance: 0, effort: 0 }), /holding/);
  const [s2, id] = startup();
  assert.throws(() => m.definirStrategie(s2, id, { croissance: 0.2, effort: 0.12 }), /Croissance visée/);
  assert.throws(() => m.definirStrategie(s2, id, { croissance: 0, effort: 0.5 }), /Budget de R&D/);
  assert.throws(() => m.definirStrategie(s2, id, { croissance: NaN, effort: 0.12 }), /Croissance visée/);
});

test('la R&D relève la marge cible, la croissance le chiffre d\'affaires ; couper fait l\'inverse', () => {
  // Même graine, mêmes ordres : la stratégie ne consomme pas d'aléa, seules ses conséquences diffèrent
  const [s0, id] = startup();
  const n = 16;
  const ref = jouer(s0, id, n);
  const rd = jouer(s0, id, n, { croissance: 0, effort: 0.16 });
  const croit = jouer(s0, id, n, { croissance: 0.03, effort: 0.12 });
  const coupe = jouer(s0, id, n, { croissance: -0.02, effort: 0.04 });
  for (const x of [ref, rd, croit, coupe]) verifier(x);
  const c = (x) => x.societes[id];
  assert.ok(c(rd).margeRef > c(ref).margeRef + 0.005, `R&D : ${c(rd).margeRef} contre ${c(ref).margeRef}`);
  assert.ok(c(rd).cash < c(ref).cash, 'la R&D se paie en trésorerie');
  assert.ok(c(croit).ca > c(ref).ca * 1.05, `croissance : ${c(croit).ca} contre ${c(ref).ca}`);
  assert.ok(c(coupe).margeRef < c(ref).margeRef - 0.005, 'couper la R&D érode la marge cible');
  assert.ok(c(coupe).ca < c(ref).ca, 'renoncer à la croissance réduit le CA');
  assert.ok(m.ebitAnnuel(c(coupe)) > m.ebitNormatif(c(coupe)), 'couper gonfle l\'EBIT publié');
  // La marge cible ne dépasse jamais le plafond du secteur
  const long = jouer(s0, id, 60, { croissance: 0, effort: m.effortMax(s0.societes[id]) });
  assert.ok(long.societes[id].margeRef <= m.PLAFOND_MARGE * m.SECT_BY_ID.techno.marge + 1e-9);
});

test('la projection de l\'aperçu suit la clôture quand la conjoncture est neutre', () => {
  // Hors aléa (conjoncture, bruit, événements), une clôture applique exactement le pas de la projection
  const [s, id] = startup();
  const pol = { croissance: 0.02, effort: 0.15 };
  const c = { ...s.societes[id], croissanceVisee: pol.croissance, effort: pol.effort };
  const p = m.projeterStrategie(c, pol, 1);
  const d = { ...c };
  d.ca *= 1 + m.croissanceSecteur(d) / 4;
  m.evolutionStrategique(d);
  assert.ok(d.margeRef > c.margeRef && d.ca > c.ca * (1 + m.croissanceSecteur(c) / 4));
  const pipe = d.caPipeline * m.MONTEE_EN_CHARGE;
  assert.ok(Math.abs(p.ca - (d.ca + pipe)) < 1e-9);
  assert.ok(Math.abs(p.margeCible - (d.margeRef + d.margeLatente)) < 1e-12);
});

test('une sauvegarde sans champs de stratégie se joue normalement', () => {
  let [s, id] = prendreUneSociete(5);
  s = m.definirStrategie(s, id, { croissance: 0.01, effort: m.parametresEffort(s.societes[id]).norme + 0.01 });
  s = jouer(s, id, 3);
  const ancienne = structuredClone(s);
  for (const c of Object.values(ancienne.societes)) { delete c.effort; delete c.croissanceVisee; delete c.margeLatente; }
  const suite = jouer(ancienne, id, 4);
  verifier(suite);
});

test('Lemarchand vide ses filiales, Vauclair investit en R&D là où elle rapporte', () => {
  let vu = { R1: false, R2: false };
  for (let g = 1; g <= 6 && !(vu.R1 && vu.R2); g++) {
    let s = m.nouvellePartie(g);
    for (let t = 0; t < 40 && !s.fini; t++) s = m.finTrimestre(s);
    verifier(s);
    for (const e of s.journal) if (/revoit sa stratégie/.test(e.texte) && vu[e.acteur] === false) vu[e.acteur] = true;
    for (const c of m.actives(s)) {
      if (!m.parametresEffort(c) || c.effort === undefined) continue;
      assert.ok(c.effort >= 0 && c.effort <= m.effortMax(c) + 1e-9);
    }
  }
  assert.ok(vu.R2, 'Lemarchand n\'a jamais revu une stratégie');
});
