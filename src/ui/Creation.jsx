import React, { useState, useMemo } from 'react';
import { CAPITAL_MIN, JOUEUR, MARGE_MAX, SECTEURS, SECT_BY_ID, apercuCreation, controlees, creerSociete, valeurPortefeuille } from '../engine/index.js';
import { fM, fP, fT } from './format.js';

export function Creation({ s, onFermer, onValider }) {
  const ctrl = useMemo(() => controlees(s), [s]);
  const fondateurs = [JOUEUR, ...ctrl];
  const [type, setType] = useState('operationnelle');
  const [secteur, setSecteur] = useState('techno');
  const [nom, setNom] = useState('');
  const [capital, setCapital] = useState('10');
  const [fondateur, setFondateur] = useState(JOUEUR);
  const [erreur, setErreur] = useState(null);
  const k = parseFloat(String(capital).replace(',', '.'));
  const dispo = fondateur === JOUEUR ? s.joueur.cash + Math.max(0, MARGE_MAX * valeurPortefeuille(s) - s.joueur.marge) : s.societes[fondateur].cash;
  let ap = null;
  try { if (k > 0) ap = apercuCreation(s, { type, secteur, capital: k }); } catch (e) { ap = null; }
  const valider = () => { try { onValider(creerSociete(s, fondateur, { type, secteur, nom, capital: k })); } catch (e) { setErreur(e.message); } };
  const sec = SECT_BY_ID[secteur];
  return (
    <div className="voile" onClick={onFermer}>
      <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h3>Créer une société</h3>
        <div className="champ">
          <div className="options deux">{[['operationnelle', "Société d'exploitation"], ['holding', 'Holding']].map(([v, l]) => <button key={v} className={type === v ? 'actif' : ''} onClick={() => { setType(v); setErreur(null); }}>{l}</button>)}</div>
          <div className="aide" style={{ marginTop: 4 }}>{type === 'holding'
            ? "Une holding ne produit rien : elle détient des participations, emprunte sur leur valeur et peut lancer des offres payées en ses propres actions."
            : "Le capital finance des actifs industriels ; l'activité monte en charge sur deux ans. Le marché en valorise une partie tout de suite, le reste à mesure qu'elle se révèle."}</div>
        </div>
        {type === 'operationnelle' && (
          <div className="champ"><label>Secteur</label>
            <select value={secteur} onChange={e => setSecteur(e.target.value)}>{SECTEURS.map(x => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>
          </div>
        )}
        <div className="champ"><label>Raison sociale</label>
          <input type="text" maxLength={40} value={nom} placeholder={type === 'holding' ? 'Financière du Port' : 'Ateliers de la Nive'} onChange={e => { setNom(e.target.value); setErreur(null); }} autoFocus />
        </div>
        {fondateurs.length > 1 && (
          <div className="champ"><label>Fondateur et actionnaire unique</label>
            <select value={fondateur} onChange={e => setFondateur(e.target.value)}>{fondateurs.map(f => <option key={f} value={f}>{f === JOUEUR ? 'Vous' : s.societes[f].nom}</option>)}</select>
          </div>
        )}
        <div className="champ"><label>Capital apporté (M€) — minimum {CAPITAL_MIN[type]} M€, disponible {fM(dispo)}</label>
          <input type="number" inputMode="decimal" min={CAPITAL_MIN[type]} step="0.5" value={capital} onChange={e => { setCapital(e.target.value); setErreur(null); }} />
          <div className="raccourcis">{[0.25, 0.5, 1].map(f => <button key={f} onClick={() => setCapital((Math.floor(dispo * f * 10) / 10).toString())}>{fP(f)}</button>)}</div>
        </div>
        {ap && (
          <div className="apercu">
            <div className="ligne"><span>Frais de constitution</span><b>{fM(ap.frais)}</b></div>
            {type === 'holding' ? (
              <div className="ligne"><span>Trésorerie de départ</span><b>{fM(ap.cash)}</b></div>
            ) : (<>
              <div className="ligne"><span>Actifs industriels</span><b>{fM(ap.actifs)}</b></div>
              <div className="ligne"><span>Trésorerie de départ</span><b>{fM(ap.cash)}</b></div>
              <div className="ligne"><span>Chiffre d'affaires visé</span><b>{fM(ap.caCible)} à marge {fP(sec.marge, 1)}</b></div>
              <div className="ligne"><span>Valeur de marché à la création</span><b>{fM(ap.valeurInitiale)}</b></div>
              <div className="ligne"><span>Valeur attendue à maturité</span><b>≈ {fM(ap.valeurMaturite)}, hors conjoncture</b></div>
            </>)}
            <div className="ligne"><span>Détention de départ</span><b>100 % ({fT(k / 10)} actions à 10 € nominal)</b></div>
          </div>
        )}
        {erreur && <div className="erreur">{erreur}</div>}
        <div className="boutons"><button onClick={onFermer}>Annuler</button><button className="plein" onClick={valider} disabled={!(k > 0)}>Créer</button></div>
      </div>
    </div>
  );
}
