import React from 'react';
import { MARGE_MAX, RAIDERS, fortune, libelleTour, valeurPortefeuille } from '../engine/index.js';
import { fM, fP } from './format.js';

export function Bandeau({ s, onFin, onNouvelle }) {
  const f = fortune(s), pf = valeurPortefeuille(s), j = s.joueur;
  const ratio = pf > 0 ? j.marge / pf : 0;
  const conj = s.conj > 0.3 ? 'expansion' : s.conj < -0.3 ? 'récession' : 'stable';
  const rang = 1 + RAIDERS.filter(r => s.raiders[r.id].actif && fortune(s, r.id) > f).length;
  return (
    <header className="bandeau">
      <div className="masthead">Le Raider<small>{libelleTour(s.tour)} — {s.fini ? 'partie terminée' : `${s.nbTours - s.tour} trimestres restants`}</small></div>
      <div className="chiffre"><b>{fM(f)}</b><span>fortune nette</span></div>
      <div className="chiffre"><b>{fM(j.cash)}</b><span>trésorerie</span></div>
      <div className="chiffre"><b className={ratio > MARGE_MAX ? 'baisse' : ''}>{fM(j.marge)}</b><span>dette sur marge{pf > 0 ? ` (${fP(ratio)})` : ''}</span></div>
      <div className="chiffre"><b>{fM(pf)}</b><span>portefeuille</span></div>
      <div className="chiffre"><b>{fP(s.taux, 2)}</b><span>taux directeur</span></div>
      <div className="chiffre"><b>{conj}</b><span>conjoncture</span></div>
      <div className="chiffre"><b>{rang}{rang === 1 ? 'er' : 'e'} / {1 + RAIDERS.length}</b><span>classement</span></div>
      <div className="fin">
        {s.fini ? <button onClick={onNouvelle}>Nouvelle partie</button> : <button className="plein" onClick={onFin}>Clôturer le trimestre</button>}
      </div>
    </header>
  );
}
