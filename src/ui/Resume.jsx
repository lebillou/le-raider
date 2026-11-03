import React from 'react';
import { fE, fM, fP, signe, classeVar } from './format.js';

// Résumé d'une clôture : votre fortune, vos sociétés, ce qui vous concerne, puis les concurrents et le marché
export function ResumeTrimestre({ r, onFermer, afficher, onAfficher }) {
  const delta = r.fortuneApres - r.fortuneAvant;
  const liste = (titre, entrees, vide) => (<>
    <h3 className="tit">{titre}</h3>
    {entrees.length ? <ul className="journal">{entrees.map((e, i) => <li key={i} className={e.type}><div>{e.texte}</div></li>)}</ul> : <div className="vide">{vide}</div>}
  </>);
  return (
    <div className="voile" onClick={onFermer}>
      <div className="modal large resume" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h3>Clôture du {r.periode}</h3>
        <div className="grille">
          <div className="ligne"><span>Votre fortune</span><b>{fM(r.fortuneAvant)} → {fM(r.fortuneApres)} <span className={classeVar(delta)}>({delta >= 0 ? '+' : ''}{fM(delta)})</span></b></div>
          <div className="ligne"><span>Classement</span><b>{r.rangAvant === r.rangApres ? `${r.rangApres}${r.rangApres === 1 ? 'er' : 'e'}` : `${r.rangAvant}e → ${r.rangApres}${r.rangApres === 1 ? 'er' : 'e'}`}</b></div>
          <div className="ligne"><span>Indice du marché</span><b className={classeVar(r.indice)}>{signe(r.indice)}</b></div>
          <div className="ligne"><span>Taux directeur</span><b>{fP(r.tauxAvant, 2)} → {fP(r.tauxApres, 2)}</b></div>
        </div>
        {r.lignes.length > 0 && (<>
          <h3 className="tit">Vos sociétés et vos lignes</h3>
          {r.lignes.slice(0, 10).map(l => {
            const v = l.active && l.prixAvant > 0 ? l.prixApres / l.prixAvant - 1 : -1;
            return (
              <div className="ligne" key={l.id}>
                <span style={{ fontFamily: 'var(--serif)', color: 'var(--encre)' }}>{l.nom}{l.controlee && <span className="ctrl">ctrl</span>}</span>
                <b>{l.active ? <>{fE(l.prixApres)} <span className={classeVar(v)}>({signe(v)})</span>{l.valeurApres > 0 ? ` · votre ligne ${fM(l.valeurApres)}` : ''}{l.courte > 0 ? ' · vendue à découvert' : ''}</> : <span className="baisse">disparue</span>}</b>
              </div>
            );
          })}
        </>)}
        {liste('Vous concernant', r.vous, 'Rien de particulier ce trimestre.')}
        {liste('Concurrents', r.concurrents, 'Pas de mouvement notable.')}
        {liste('Marché', r.marche, 'Aucun événement.')}
        {r.routine > 0 && <div className="aide">Opérations courantes des concurrents, détaillées dans le journal : {r.descriptionRoutine}.</div>}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}><input type="checkbox" checked={afficher} onChange={e => onAfficher(e.target.checked)} style={{ width: 'auto' }} />Afficher ce résumé à chaque clôture</label>
        <div className="boutons"><button className="plein" onClick={onFermer} autoFocus>Continuer</button></div>
      </div>
    </div>
  );
}
