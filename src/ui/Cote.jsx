import React, { useState, useMemo } from 'react';
import { NOTATIONS, SECTEURS, SECT_BY_ID, actives, capi, controlees, detentionEffective, estHolding, libelleTour, notation, per } from '../engine/index.js';
import { Spark } from './Graphiques.jsx';
import { classeVar, fE, fM, fP, nf, signe } from './format.js';

export const COLONNES = [
  { id: 'nom', l: 'Société', v: (s, c) => c.nom },
  { id: 'prix', l: 'Cours', v: (s, c) => c.prix },
  { id: 'var', l: 'Var.', v: (s, c) => c.hist.length > 1 ? c.prix / c.hist[c.hist.length - 2] - 1 : 0 },
  { id: 'capi', l: 'Capi.', v: (s, c) => capi(c) },
  { id: 'per', l: 'PER', v: (s, c) => per(s, c) ?? 999, m: true },
  { id: 'note', l: 'Note', v: (s, c) => NOTATIONS.indexOf(notation(c, s)), m: true },
  { id: 'vous', l: 'Vous', v: (s, c, ctrl) => detentionEffective(s, c.id, ctrl) },
];

export function Cote({ s, sel, onSel, onCreer }) {
  const [tri, setTri] = useState({ id: 'capi', desc: true });
  const [secteur, setSecteur] = useState('');
  const ctrl = useMemo(() => controlees(s), [s]);
  const lignes = useMemo(() => {
    const col = COLONNES.find(c => c.id === tri.id);
    let arr = actives(s).filter(c => !secteur || c.secteur === secteur).map(c => ({ c, k: col.v(s, c, ctrl) }));
    arr.sort((a, b) => (typeof a.k === 'string' ? a.k.localeCompare(b.k) : a.k - b.k) * (tri.desc ? -1 : 1));
    return arr;
  }, [s, tri, secteur, ctrl]);
  const clic = (id) => setTri(t => ({ id, desc: t.id === id ? !t.desc : id !== 'nom' }));
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <select value={secteur} onChange={e => setSecteur(e.target.value)} style={{ width: 'auto' }} aria-label="Filtrer par secteur">
          <option value="">Tous secteurs</option>
          {SECTEURS.map(x => <option key={x.id} value={x.id}>{x.nom}</option>)}
          {actives(s).some(estHolding) && <option value="holding">Holdings</option>}
        </select>
        <span style={{ color: 'var(--sourd)', fontSize: 11 }}>{lignes.length} valeurs cotées</span>
        {onCreer && !s.fini && <button onClick={onCreer} style={{ marginLeft: 'auto' }}>Créer une société</button>}
      </div>
      <table className="cote">
        <thead><tr>{COLONNES.map(col => <th key={col.id} className={(tri.id === col.id ? 'tri ' : '') + (col.m ? 'cache-mobile' : '')} onClick={() => clic(col.id)}>{col.l}{tri.id === col.id ? (tri.desc ? ' ▾' : ' ▴') : ''}</th>)}<th className="cache-mobile">6 trim.</th></tr></thead>
        <tbody>
          {lignes.map(({ c }) => {
            const v = COLONNES[2].v(s, c), d = detentionEffective(s, c.id, ctrl), p = per(s, c);
            return (
              <tr key={c.id} className={sel === c.id ? 'sel' : ''} onClick={() => onSel(c.id)}>
                <td className="nom">{c.nom}<small>{SECT_BY_ID[c.secteur].nom}{c.actionnaires.noyau ? ' · noyau dur' : ''}{c.creePar ? ' · créée en ' + libelleTour(c.creeAu) : ''}</small></td>
                <td>{fE(c.prix)}</td>
                <td className={classeVar(v)}>{signe(v)}</td>
                <td>{fM(capi(c))}</td>
                <td className="cache-mobile">{p ? nf(1).format(p) : '—'}</td>
                <td className="cache-mobile">{notation(c, s)}</td>
                <td>{d > 0.0005 ? fP(d, 1) : ''}{ctrl.has(c.id) && <span className="ctrl">ctrl</span>}</td>
                <td className="cache-mobile"><Spark hist={c.hist.slice(-7)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
