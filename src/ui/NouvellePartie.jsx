import React, { useState } from 'react';

export function NouvellePartie({ onFermer, onCreer }) {
  const [ans, setAns] = useState(20);
  return (
    <div className="voile" onClick={onFermer}>
      <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h3>Nouvelle partie</h3>
        <div className="champ"><label>Durée de la partie</label>
          <div className="options">{[20, 30, 50].map(a => <button key={a} className={ans === a ? 'actif' : ''} onClick={() => setAns(a)}>{a} ans</button>)}</div>
          <div className="aide">Vous et vos trois concurrents partez avec 25 M€ chacun. Une partie arrivée à son terme peut toujours être prolongée de dix ans.</div>
        </div>
        <div className="boutons"><button onClick={onFermer}>Annuler</button><button className="plein" onClick={() => onCreer(ans)}>Commencer</button></div>
      </div>
    </div>
  );
}
