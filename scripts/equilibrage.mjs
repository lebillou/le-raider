// Banc d'essai de l'équilibre : fortunes finales des stratégies de référence et des raiders.
// Usage : npm run equilibrage [-- --graines 12 --ans 20]
// À relancer après toute modification d'un paramètre de jeu ; comparer aux repères de CLAUDE.md.
import * as m from '../src/engine/index.js';

const J = m.JOUEUR;
const arg = (nom, def) => { const i = process.argv.indexOf('--' + nom); return i > 0 ? Number(process.argv[i + 1]) : def; };
const GRAINES = arg('graines', 12), TOURS = 4 * arg('ans', 20), BASE = 300;
const f0 = (x) => Math.round(x).toString();
const quartiles = (a) => { const t = [...a].sort((x, y) => x - y); const q = (p) => t[Math.min(t.length - 1, Math.floor(p * t.length))]; return [t[0], q(0.25), q(0.5), q(0.75), t[t.length - 1]]; };

function jouer(graine, strategie) {
  let s = m.nouvellePartie(graine, { nbTours: TOURS });
  for (let t = 0; t < TOURS && !s.fini; t++) { s = strategie(s, t); s = m.finTrimestre(s); }
  return s;
}

// Achète tout le marché au départ et ne fait plus rien
const indice = (s, t) => {
  if (t) return s;
  const socs = m.actives(s);
  for (const c of socs) { try { s = m.acheter(s, J, c.id, 24 / socs.length); } catch (e) { /* flottant épuisé */ } }
  return s;
};
// Chaque année : vend les PER les plus élevés, achète les plus bas
const value = (s, t) => {
  if (t % 4) return s;
  const socs = m.actives(s).map(c => ({ c, per: m.per(s, c) || 99 })).sort((a, b) => a.per - b.per);
  for (const { c } of socs.slice(-10)) if (c.actionnaires[J]) { try { s = m.vendre(s, J, c.id, c.actionnaires[J]); } catch (e) { /* rien à vendre */ } }
  const cash = s.joueur.cash;
  for (const { c } of socs.slice(0, 8)) { try { s = m.acheter(s, J, c.id, cash / 8); } catch (e) { /* refus */ } }
  return s;
};
// Crée une société tech et y réinvestit toute sa trésorerie
const batisseur = (s, t) => {
  if (t === 0) return m.creerSociete(s, J, { type: 'operationnelle', secteur: 'techno', nom: 'Startup', capital: 24.5 });
  const c = s.societes.F1;
  if (c?.active && c.cash > 0.08 * c.ca + 0.5) { try { s = m.investir(s, 'F1', c.cash - 0.08 * c.ca); } catch (e) { /* refus */ } }
  return s;
};
// Raider : OPA au contrôle minimal, filiales endettées et vidées par dividendes exceptionnels ; option haut rendement
const raider = (avecHY) => (s) => {
  let ctl = m.repartitionControle(s);
  for (const id of m.controlees(s, J, ctl)) {
    if (m.estHolding(s.societes[id])) continue;
    try { s = m.restructurer(s, id); } catch (e) { /* trop tôt */ }
    try { const c = s.societes[id]; const cap = Math.min(m.capaciteEmprunt(c, s), 3 * m.ebitAnnuel(c) - m.detteTotale(c)); if (cap > 1) s = m.emprunter(s, id, cap); } catch (e) { /* refus */ }
    if (avecHY) { try { const c = s.societes[id]; if (!c.obligations?.length) { const cap = m.capaciteObligataire(s, c, 'hy') * 0.6; if (cap > 1) s = m.emettreObligations(s, id, { montant: cap, maturite: 7, type: 'hy' }); } } catch (e) { /* refus */ } }
    try { const c = s.societes[id]; if (c.cash > 0.06 * c.ca + 0.5) s = m.dividendeExceptionnel(s, id, c.cash - 0.06 * c.ca); } catch (e) { /* refus */ }
  }
  ctl = m.repartitionControle(s);
  const dispo = s.joueur.cash + Math.max(0, 0.4 * m.valeurPortefeuille(s) - s.joueur.marge);
  const cibles = m.actives(s).filter(c => !ctl[c.id] || ctl[c.id].startsWith('noyau')).sort((a, b) => m.capi(a) - m.capi(b)).slice(0, 15);
  for (const c of cibles) for (const p of [0.15, 0.25, 0.35]) {
    const ap = m.apercuOPA(s, J, c.id, p, 1, ctl);
    if (!ap.prendControle) continue;
    if (ap.cout <= dispo) { try { return m.lancerOPA(s, J, c.id, p); } catch (e) { /* refus */ } }
    break;
  }
  return s;
};

const strategies = [['Indice', indice], ['Value (PER)', value], ['Bâtisseur', batisseur], ['Raider', raider(false)], ['Raider + haut rendement', raider(true)]];
console.log(`Équilibre sur ${GRAINES} graines, ${TOURS / 4} ans, 25 M€ au départ. Fortune finale en M€ : min / q1 / médiane / q3 / max\n`);
console.log('| Acteur | min | q1 | médiane | q3 | max | ruines |');
console.log('|---|---|---|---|---|---|---|');
const raiders = Object.fromEntries(m.RAIDERS.map(r => [r.id, []]));
for (const [nom, st] of strategies) {
  const f = [];
  for (let g = BASE; g < BASE + GRAINES; g++) {
    const s = jouer(g, st);
    f.push(m.fortune(s));
    if (nom === 'Indice') for (const r of m.RAIDERS) raiders[r.id].push(s.raiders[r.id].actif ? m.fortune(s, r.id) : 0);
  }
  console.log(`| ${nom} | ${quartiles(f).map(f0).join(' | ')} | ${f.filter(x => x < 0).length} |`);
}
for (const r of m.RAIDERS) console.log(`| ${r.nom} (IA) | ${quartiles(raiders[r.id]).map(f0).join(' | ')} | ${raiders[r.id].filter(x => x <= 0).length} |`);
