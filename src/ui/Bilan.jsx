import React from 'react';
import { JOUEUR, RAIDERS, controlees, fortune, libelleTour, mandatsDe, titre } from '../engine/index.js';
import { COULEURS, CourbeFortune, seriesFortune } from './Graphiques.jsx';
import { Chronologie } from './Journal.jsx';
import { fM, fMp } from './format.js';

export function Bilan({ s, onNouvelle, onProlonger, onSel }) {
  const f = fortune(s);
  const acteurs = [{ id: JOUEUR, nom: 'Vous', f, actif: true }, ...RAIDERS.map(r => ({ id: r.id, nom: r.nom, f: s.raiders[r.id].actif ? fortune(s, r.id) : 0, actif: s.raiders[r.id].actif }))];
  const classement = acteurs.slice().sort((a, b) => b.f - a.f);
  const compte = (id, re) => s.journal.filter(e => e.acteur === id && re.test(e.texte)).length;
  const lignes = [
    ['Fortune finale', (a) => fM(a.f)],
    ['Sociétés contrôlées', (a) => a.actif ? controlees(s, a.id).size : '—'],
    ['Offres lancées (OPA, OPE)', (a) => compte(a.id, /^(OPA|OPE|Offre mixte) de/)],
    ['Sociétés créées', (a) => compte(a.id, /^Vous créez|^[^:]+ crée (la holding )?[^ ]/)],
    ['Fusions', (a) => compte(a.id, /absorbe/)],
    ['Achats au marché', (a) => compte(a.id, /achète/)],
    ['Ventes', (a) => compte(a.id, /cède|apportez/)],
    ['Emprunts de filiales', (a) => compte(a.id, /emprunte/)],
    ['Dividendes exceptionnels', (a) => compte(a.id, /dividende exceptionnel/)],
    ['Restructurations', (a) => compte(a.id, /restructuration/)],
    ['Augmentations de capital', (a) => compte(a.id, /augmentation de capital/)],
    ['Émissions obligataires', (a) => compte(a.id, /émet .* d'obligations/)],
    ['Défauts obligataires', (a) => compte(a.id, /^Défaut de/)],
    ['Présidences à la clôture', (a) => a.actif ? mandatsDe(s, a.id).length : '—'],
    ['Rémunérations nettes perçues', (a) => fMp((a.id === JOUEUR ? s.joueur : s.raiders[a.id]).remTotale || 0)],
    ['Appels de marge', (a) => compte(a.id, /Appel de marge/)],
  ];
  const plusGrosse = (id) => s.journal.filter(e => e.acteur === id && /^(OPA|OPE|Offre mixte) de/.test(e.texte)).map(e => ({ e, m: parseFloat((e.texte.match(/([\d.]+) M€\.?/) || [])[1]) })).filter(x => x.m > 0).sort((a, b) => b.m - a.m)[0];
  return (
    <div>
      <div className="fin-partie" style={{ padding: '10px 0 6px' }}>
        <div className="tampon">{s.fini?.raison === 'ruine' ? 'Ruine' : `Clôture des ${s.nbTours / 4} ans`}</div>
        <div className="grand">{fM(f)}</div>
        <div className="sous" style={{ fontSize: 15 }}>{titre(Math.max(f, 0))} · {classement.findIndex(x => x.id === JOUEUR) + 1}{classement[0].id === JOUEUR ? 'er' : 'e'} sur {classement.length}</div>
        <div className="actions" style={{ justifyContent: 'center' }}>
          {s.fini?.raison === 'terme' && <button className="plein" onClick={onProlonger}>Prolonger de 10 ans</button>}
          <button onClick={onNouvelle}>Nouvelle partie</button>
        </div>
      </div>
      <h3 className="tit">Fortunes comparées</h3>
      <div className="legende">{acteurs.map(a => <span key={a.id}><i style={{ background: COULEURS[a.id] }} />{a.nom}</span>)}</div>
      <CourbeFortune series={seriesFortune(s)} nbTours={s.nbTours} hauteur={160} />
      <h3 className="tit">Palmarès</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="bilan">
          <thead><tr><th></th>{classement.map(a => <th key={a.id}>{a.nom}</th>)}</tr></thead>
          <tbody>{lignes.map(([l, fn]) => <tr key={l}><td>{l}</td>{classement.map(a => <td key={a.id} className={a.id === JOUEUR ? 'vous' : ''}>{fn(a)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {acteurs.map(a => { const g = plusGrosse(a.id); return g ? <div className="ligne" key={a.id}><span>Plus grosse offre de {a.nom}</span><b style={{ whiteSpace: 'normal', textAlign: 'right' }}>{libelleTour(g.e.tour)} — {g.e.texte.replace(/^.*? sur /, '').split(' à ')[0]} ({fM(g.m)})</b></div> : null; })}
      <h3 className="tit">Empires à la clôture</h3>
      {acteurs.filter(a => a.actif).map(a => { const c = [...controlees(s, a.id)].map(id => s.societes[id]); return c.length ? <div className="ligne" key={a.id}><span>{a.nom}</span><b style={{ whiteSpace: 'normal', textAlign: 'right' }}>{c.map((x, i) => <span key={x.id}><button onClick={() => onSel(x.id)} style={{ border: 0, padding: 0, fontFamily: 'var(--serif)', fontSize: 13 }}>{x.nom}</button>{i < c.length - 1 ? ', ' : ''}</span>)}</b></div> : null; })}
      <h3 className="tit">Chronique complète</h3>
      <Chronologie s={s} limite={600} />
    </div>
  );
}

export function FinPartie(props) { return <Bilan {...props} />; }
