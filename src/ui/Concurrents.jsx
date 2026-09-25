import React from 'react';
import { JOUEUR, RAIDERS, actives, controlees, fortune, mandatsDe, pct } from '../engine/index.js';
import { libelleReglages } from './format.js';
import { fM, fMp, fP } from './format.js';

export function Concurrents({ s, onSel }) {
  const f = fortune(s);
  const classement = [{ id: JOUEUR, nom: 'Vous', f }, ...RAIDERS.map(r => ({ id: r.id, nom: r.nom, f: s.raiders[r.id].actif ? fortune(s, r.id) : 0 }))].sort((a, b) => b.f - a.f);
  const rang = classement.findIndex(x => x.id === JOUEUR) + 1;
  return (
    <div>
      <h2 className="rs">Les concurrents</h2>
      <div className="sous">{libelleReglages(s)}</div>
      <div className="sous">Vous êtes {rang}{rang === 1 ? 'er' : 'e'} sur {classement.length} : {classement.map(x => `${x.nom} ${fM(x.f)}`).join(' · ')}</div>
      {RAIDERS.map(r => {
        const cp = s.raiders[r.id];
        const ctrl = cp.actif ? controlees(s, r.id) : new Set();
        const pos = cp.actif ? actives(s).filter(c => c.actionnaires[r.id] > 0).sort((a, b) => b.actionnaires[r.id] * b.prix - a.actionnaires[r.id] * a.prix) : [];
        return (
          <div className="rival" key={r.id}>
            <h4>{r.nom}</h4>
            <div className="devise">{r.devise}</div>
            {!cp.actif ? <div className="tampon" style={{ fontSize: 18 }}>En cessation de paiements</div> : (<>
              <div className="grille">
                <div className="ligne"><span>Fortune</span><b>{fM(fortune(s, r.id))}</b></div>
                <div className="ligne"><span>Trésorerie</span><b>{fM(cp.cash)}</b></div>
                <div className="ligne"><span>Dette sur marge</span><b>{fM(cp.marge)}</b></div>
                <div className="ligne"><span>Apporte à une OPA dès</span><b>{fP(r.seuilApport)} de prime</b></div>
                <div className="ligne"><span>Présidences</span><b>{mandatsDe(s, r.id).map(c => c.nom).join(', ') || 'aucune'}</b></div>
                <div className="ligne"><span>Rémunérations perçues</span><b>{fMp(cp.remTotale || 0)}</b></div>
              </div>
              {pos.length > 0 && <div style={{ marginTop: 6 }}>{pos.slice(0, 8).map(c => <div className="ligne" key={c.id} style={{ cursor: 'pointer' }} onClick={() => onSel(c.id)}><span style={{ color: 'var(--encre)', fontFamily: 'var(--serif)', fontSize: 14 }}>{c.nom}{ctrl.has(c.id) && <span className="ctrl">ctrl</span>}</span><b>{fP(pct(c, r.id), 1)} · {fM(c.actionnaires[r.id] * c.prix)}</b></div>)}{pos.length > 8 && <div className="sous">et {pos.length - 8} autres lignes</div>}</div>}
            </>)}
          </div>
        );
      })}
    </div>
  );
}
