// Invariants comptables vérifiés par les tests.
import { actives } from './acces.js';
import { CROISSANCE_MAX, CROISSANCE_MIN, effortMax } from './strategie.js';

// ---------- INVARIANTS (tests) ----------
export function verifierInvariants(s) {
  const err = [];
  for (const c of actives(s)) {
    const somme = Object.values(c.actionnaires).reduce((a, b) => a + b, 0);
    if (Math.abs(somme - c.actions) > 1e-6 * Math.max(1, c.actions)) err.push(`${c.id}: actionnaires ${somme} ≠ actions ${c.actions}`);
    for (const [h, t] of Object.entries(c.actionnaires)) if (t < -1e-9 || !isFinite(t)) err.push(`${c.id}: ${h} détient ${t}`);
    for (const k of ['ca', 'marge', 'actifs', 'dette', 'cash', 'prix', 'actions']) if (!isFinite(c[k])) err.push(`${c.id}.${k} = ${c[k]}`);
    if (c.prix <= 0) err.push(`${c.id}: prix ${c.prix}`);
    if (c.actions <= 0) err.push(`${c.id}: actions ${c.actions}`);
    if (c.actionnaires[c.id]) err.push(`${c.id} se détient elle-même`);
    for (const k of ['margeRef', 'margeLatente', 'effort', 'croissanceVisee']) if (c[k] !== undefined && !isFinite(c[k])) err.push(`${c.id}.${k} = ${c[k]}`);
    if (c.effort !== undefined && (c.effort < -1e-9 || c.effort > effortMax(c) + 1e-9)) err.push(`${c.id}: budget ${c.effort} hors bornes`);
    if (c.croissanceVisee !== undefined && (c.croissanceVisee < CROISSANCE_MIN - 1e-9 || c.croissanceVisee > CROISSANCE_MAX + 1e-9)) err.push(`${c.id}: croissance visée ${c.croissanceVisee} hors bornes`);
    for (const o of c.obligations || []) if (!(o.nominal > 0) || !isFinite(o.coupon) || !(o.echeance > 0)) err.push(`${c.id}: obligation invalide ${JSON.stringify(o)}`);
  }
  const j = s.joueur;
  if (j.cash < -1e-9 || j.marge < -1e-9 || !isFinite(j.cash) || !isFinite(j.marge)) err.push(`joueur cash=${j.cash} marge=${j.marge}`);
  for (const [id, cp] of Object.entries(s.raiders)) if (cp.cash < -1e-9 || cp.marge < -1e-9 || !isFinite(cp.cash) || !isFinite(cp.marge)) err.push(`${id} cash=${cp.cash} marge=${cp.marge}`);
  return err;
}
