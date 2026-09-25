import React, { useState } from 'react';
import { JOUEUR, RAIDERS, libelleTour, nomDetenteur } from '../engine/index.js';
import { COULEURS } from './Graphiques.jsx';

export const TYPES_CHRONO = [['', 'Tout'], ['marche', 'Marché et événements'], ['opa', 'OPA et fusions'], ['ordres', 'Achats et ventes'], ['filiale', 'Pilotage de sociétés'], ['alerte', 'Alertes et faillites']];

export const categorie = (e) => e.acteur === 'marche' && e.type !== 'faillite' ? 'marche'
  : /^(OPA|OPE|Offre mixte) |absorbe/.test(e.texte) ? 'opa'
  : /achète|cède|apportez/.test(e.texte) ? 'ordres'
  : /créez|crée /.test(e.texte) ? 'filiale'
  : /faillite|alerte|fin|cessation|Appel de marge|liquidation/.test(e.type + e.texte) ? 'alerte'
  : 'filiale';

export function Chronologie({ s, limite = 400 }) {
  const [acteur, setActeur] = useState('');
  const [type, setType] = useState('');
  const lignes = s.journal.filter(e => (!acteur || e.acteur === acteur) && (!type || categorie(e) === type));
  const nomA = (a) => a === 'marche' ? 'Marché' : nomDetenteur(s, a);
  return (
    <div>
      <div className="filtres">
        <select value={acteur} onChange={e => setActeur(e.target.value)} aria-label="Filtrer par acteur"><option value="">Tous les acteurs</option><option value={JOUEUR}>Vous</option>{RAIDERS.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}<option value="marche">Marché</option></select>
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Filtrer par type">{TYPES_CHRONO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <span style={{ color: 'var(--sourd)', fontSize: 11, alignSelf: 'center' }}>{lignes.length} entrées{lignes.length > limite ? `, ${limite} affichées` : ''}</span>
      </div>
      <ul className="journal">
        {lignes.slice(0, limite).map((e, i) => <li key={i} className={e.type}><span>{libelleTour(e.tour)}<br /><small style={{ color: COULEURS[e.acteur] || 'var(--sourd)' }}>{e.acteur === 'marche' ? '' : nomA(e.acteur).split(' ')[0]}</small></span><div>{e.texte}</div></li>)}
      </ul>
    </div>
  );
}

export function Journal({ s }) { return <Chronologie s={s} />; }
