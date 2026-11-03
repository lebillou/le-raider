import React, { useState } from 'react';
import { DIFFICULTES, NIVEAUX_IA } from '../engine/index.js';

export function NouvellePartie({ onFermer, onCreer }) {
  const [ans, setAns] = useState(20);
  const [difficulte, setDifficulte] = useState('normal');
  const [niveauIA, setNiveauIA] = useState('normal');
  const [fiscalite, setFiscalite] = useState(false);
  return (
    <div className="voile" onClick={onFermer}>
      <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h3>Nouvelle partie</h3>
        <div className="champ"><label>Durée de la partie</label>
          <div className="options">{[20, 30, 50].map(a => <button key={a} className={ans === a ? 'actif' : ''} onClick={() => setAns(a)}>{a} ans</button>)}</div>
          <div className="aide">Une partie arrivée à son terme peut toujours être prolongée de dix ans.</div>
        </div>
        <div className="champ"><label>Difficulté</label>
          <div className="options">{Object.entries(DIFFICULTES).map(([k, d]) => <button key={k} className={difficulte === k ? 'actif' : ''} onClick={() => setDifficulte(k)}>{d.nom}</button>)}</div>
          <div className="aide">{DIFFICULTES[difficulte].texte}</div>
        </div>
        <div className="champ"><label>Vos concurrents</label>
          <div className="options">{Object.entries(NIVEAUX_IA).map(([k, n]) => <button key={k} className={niveauIA === k ? 'actif' : ''} onClick={() => setNiveauIA(k)}>{n.nom}</button>)}</div>
          <div className="aide">{NIVEAUX_IA[niveauIA].texte}</div>
        </div>
        <div className="champ">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--encre)' }}><input type="checkbox" checked={fiscalite} onChange={e => setFiscalite(e.target.checked)} style={{ width: 'auto' }} />Fiscalité réaliste</label>
          <div className="aide">30 % de prélèvement sur les dividendes et intérêts que vous percevez en personne ; vos holdings, comme les raiders, les reçoivent sans prélèvement (régime mère-fille). Il faut alors structurer son empire par une holding : la partie devient nettement plus difficile.</div>
        </div>
        <div className="boutons"><button onClick={onFermer}>Annuler</button><button className="plein" onClick={() => onCreer(ans, { difficulte, niveauIA, fiscalite })}>Commencer</button></div>
      </div>
    </div>
  );
}
