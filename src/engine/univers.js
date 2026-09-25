// Génération d'une nouvelle partie.
import { actives, capi, flottant, fortune } from './acces.js';
import { gauss, mulberry32 } from './alea.js';
import { NB_TOURS, RAIDERS, estRaider } from './config.js';
import { journal } from './creation.js';
import { ebitAnnuel } from './finance.js';
import { NOMS, SECTEURS, SECT_BY_ID } from './secteurs.js';
import { prixCible } from './valorisation.js';

// ---------- UNIVERS ----------
export function genererSociete(r, secId, nom, idx, rangTaille) {
  const sec = SECT_BY_ID[secId];
  // une grande, une petite, trois moyennes par secteur
  const caLog = rangTaille === 0 ? 7.5 + 0.6 * r() : rangTaille === 4 ? 3.9 + 0.7 * r() : 4.8 + 2.2 * r();
  const ca = Math.round(Math.exp(caLog));                       // 50 M€ à 3 300 M€
  const marge = sec.marge * (0.6 + 0.8 * r());
  const rot = sec.rot * (0.8 + 0.4 * r());
  const actifs = ca / rot;
  const ebit0 = ca * marge;
  const dette = Math.min(ebit0 * (0.5 + 3 * r()), 0.6 * actifs);   // levier initial 0,5× à 3,5× l'EBIT
  const cash = ca * (0.03 + 0.09 * r());
  const noyauPct = r() < 0.45 ? 0.15 + 0.3 * r() : 0;
  const c = {
    id: `${secId}${idx}`, nom, secteur: secId, active: true,
    ca, marge, margeRef: marge, rot, actifs, dette, cash,
    payout: 0.25 + 0.35 * r(),
    actions: 1, prix: 1,
    actionnaires: {},
    detresse: 0, hist: [], histCa: [], sentiment: 0,
    fondee: true,
  };
  return { c, noyauPct };
}

export function nouvellePartie(graine = Math.floor(Math.random() * 1e9), options = {}) {
  const r = mulberry32(graine);
  const s = {
    graine, tour: 0, nbTours: options.nbTours || NB_TOURS, taux: 0.045, conj: 0, conjSecteurs: {},
    societes: {}, ordre: [],
    joueur: { cash: 25, marge: 0, histFortune: [25], fortuneMax: 25, remTotale: 0 },
    indice: 100,
    raiders: {}, offres: [], nbFondees: 0,
    journal: [], evenements: [], fini: null, stats: { opa: 0, fusions: 0, faillites: 0 },
  };
  for (const rd of RAIDERS) s.raiders[rd.id] = { cash: rd.cash, marge: 0, actif: true, histFortune: [], biais: {}, acquis: {}, remTotale: 0 };
  for (const sec of SECTEURS) s.conjSecteurs[sec.id] = 0;
  s.conjSecteurs.holding = 0;
  const noyaux = {};
  for (const sec of SECTEURS) {
    const tailles = [0, 1, 2, 3, 4].sort(() => r() - 0.5);
    NOMS[sec.id].forEach((nom, i) => {
      const { c, noyauPct } = genererSociete(r, sec.id, nom, i, tailles[i]);
      s.societes[c.id] = c; s.ordre.push(c.id); noyaux[c.id] = noyauPct;
    });
  }
  // Participations croisées initiales, sans boucle : une société en détient une autre plus petite
  const ids = s.ordre.slice();
  for (let k = 0; k < 8; k++) {
    const a = s.societes[ids[Math.floor(r() * ids.length)]];
    const b = s.societes[ids[Math.floor(r() * ids.length)]];
    if (a === b || a.ca < b.ca * 2 || Object.keys(b.actionnaires).length) continue;
    b.actionnaires[a.id] = 0.08 + 0.25 * r();     // fraction, convertie en titres plus bas
  }
  // Nombre d'actions : fixé pour un prix initial entre 8 et 160 €
  for (const c of actives(s)) {
    c.actions = 1;
    const cpProv = Math.max(ebitAnnuel(c), 0.02 * c.ca) * SECT_BY_ID[c.secteur].mult - c.dette + c.cash;
    const prixVoulu = 8 + 150 * r();
    c.actions = Math.max(0.5, Math.round(Math.max(cpProv, 0.05 * c.ca) / prixVoulu * 10) / 10);
    const parts = {};
    let reste = 1;
    for (const [h, f] of Object.entries(c.actionnaires)) { parts[h] = f; reste -= f; }
    if (noyaux[c.id] > 0) { parts.noyau = Math.min(noyaux[c.id], reste * 0.6); reste -= parts.noyau; }
    parts.public = reste;
    c.actionnaires = Object.fromEntries(Object.entries(parts).map(([h, f]) => [h, f * c.actions]));
  }
  // Prix initial : point fixe de la valorisation avec participations (3 passes suffisent)
  for (const c of actives(s)) c.prix = 1;
  for (let it = 0; it < 6; it++) for (const c of actives(s)) c.prix = prixCible(s, c);
  for (const c of actives(s)) {
    c.sentiment = 0.13 * gauss(r);
    c.prix = c.prix * Math.exp(c.sentiment) * (0.97 + 0.06 * r());
    c.hist = [c.prix];
    c.histCa = [c.ca];
  }
  // Les raiders entrent en scène avec deux participations minoritaires chacun, payées au prix du marché
  for (const rd of RAIDERS) {
    const cp = s.raiders[rd.id];
    for (const c of actives(s)) cp.biais[c.id] = rd.sigma * gauss(r);
    const moyennes = actives(s).filter(c => capi(c) < 300 && !Object.keys(c.actionnaires).some(h => estRaider(s, h))).sort(() => r() - 0.5);
    for (const c of moyennes.slice(0, 2)) {
      const f = Math.min(0.08 + 0.12 * r(), flottant(c) / c.actions * 0.5, cp.cash * 0.3 / capi(c));
      const t = f * c.actions;
      c.actionnaires.public -= t; c.actionnaires[rd.id] = t; cp.acquis[c.id] = c.prix;
      cp.cash -= t * c.prix;   // même capital de départ que vous : 25 M€, dont une partie déjà placée
    }
    cp.histFortune.push(fortune(s, rd.id));
  }
  journal(s, 'info', `Vous démarrez avec ${s.joueur.cash} M€ et une ligne de crédit sur marge, comme chacun de vos trois concurrents. ${s.nbTours / 4} ans pour bâtir un empire.`, 'marche');
  return s;
}
