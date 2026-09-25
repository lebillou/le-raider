import React, { useState, useMemo } from 'react';
import { BRANCHE_MAX, CAPITAL_MIN, DECOTE_HOLDING, FRAIS_APPORT_NATURE, JOUEUR, MARGE_MAX, SECTEURS, SECT_BY_ID, actives, apercuCreation, controlees, creerSociete, estHolding, valeurPortefeuille } from '../engine/index.js';
import { fM, fP, fT } from './format.js';

export function Creation({ s, onFermer, onValider }) {
  const ctrl = useMemo(() => controlees(s), [s]);
  const fondateurs = [JOUEUR, ...ctrl];
  const [type, setType] = useState('operationnelle');
  const [secteur, setSecteur] = useState('techno');
  const [nom, setNom] = useState('');
  const [capital, setCapital] = useState('10');
  const [fondateur, setFondateur] = useState(JOUEUR);
  const [parts, setParts] = useState({});     // société -> fraction de la ligne apportée
  const [branche, setBranche] = useState(0);
  const [erreur, setErreur] = useState(null);
  const k = parseFloat(String(capital).replace(',', '.'));
  const positions = actives(s).filter(d => (d.actionnaires[fondateur] || 0) > 0).sort((a, b) => b.actionnaires[fondateur] * b.prix - a.actionnaires[fondateur] * a.prix);
  const titres = Object.fromEntries(positions.filter(d => parts[d.id] > 0).map(d => [d.id, parts[d.id] >= 1 ? d.actionnaires[fondateur] : parts[d.id] * d.actionnaires[fondateur]]));
  const fondatrice = fondateur !== JOUEUR ? s.societes[fondateur] : null;
  const peutBranche = type === 'operationnelle' && fondatrice && !estHolding(fondatrice);
  const brancheEff = peutBranche ? branche : 0;
  const changerFondateur = (f) => { setFondateur(f); setParts({}); setBranche(0); setErreur(null); };
  const dispo = fondateur === JOUEUR ? s.joueur.cash + Math.max(0, MARGE_MAX * valeurPortefeuille(s) - s.joueur.marge) : s.societes[fondateur].cash;
  let ap = null;
  let erreurApercu = null;
  try { if (k > 0) ap = apercuCreation(s, { type, secteur, capital: k, fondateur, titres, branche: brancheEff }); } catch (e) { ap = null; erreurApercu = e.message; }
  const valider = () => { try { onValider(creerSociete(s, fondateur, { type, secteur, nom, capital: k, titres, branche: brancheEff })); } catch (e) { setErreur(e.message); } };
  const sec = SECT_BY_ID[brancheEff > 0 ? fondatrice.secteur : secteur];
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
        {type === 'operationnelle' && brancheEff > 0 && <div className="aide">Secteur : {sec.nom}, celui de l'activité apportée par {fondatrice.nom}.</div>}
        {type === 'operationnelle' && !(brancheEff > 0) && (
          <div className="champ"><label>Secteur</label>
            <select value={secteur} onChange={e => setSecteur(e.target.value)}>{SECTEURS.map(x => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>
          </div>
        )}
        <div className="champ"><label>Raison sociale</label>
          <input type="text" maxLength={40} value={nom} placeholder={type === 'holding' ? 'Financière du Port' : 'Ateliers de la Nive'} onChange={e => { setNom(e.target.value); setErreur(null); }} autoFocus />
        </div>
        {fondateurs.length > 1 && (
          <div className="champ"><label>Fondateur et actionnaire unique</label>
            <select value={fondateur} onChange={e => changerFondateur(e.target.value)}>{fondateurs.map(f => <option key={f} value={f}>{f === JOUEUR ? 'Vous' : s.societes[f].nom}</option>)}</select>
          </div>
        )}
        <div className="champ"><label>Apport en numéraire (M€) — capital minimum {CAPITAL_MIN[type]} M€ apports en nature compris, disponible {fM(dispo)}</label>
          <input type="number" inputMode="decimal" min={CAPITAL_MIN[type]} step="0.5" value={capital} onChange={e => { setCapital(e.target.value); setErreur(null); }} />
          <div className="raccourcis">{[0.25, 0.5, 1].map(f => <button key={f} onClick={() => setCapital((Math.floor(dispo * f * 10) / 10).toString())}>{fP(f)}</button>)}</div>
        </div>
        {(positions.length > 0 || peutBranche) && (
          <div className="champ"><label>Apports en nature</label>
            {positions.map(d => (
              <div className="ligne" key={d.id}>
                <span style={{ fontFamily: 'var(--serif)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Titres {d.nom} <em style={{ fontStyle: 'normal', color: 'var(--sourd)' }}>· {fT(d.actionnaires[fondateur])}, {fM(d.actionnaires[fondateur] * d.prix)}</em></span>
                <select value={parts[d.id] || 0} onChange={e => { setParts({ ...parts, [d.id]: Number(e.target.value) }); setErreur(null); }} style={{ width: 'auto' }} aria-label={`Part des titres ${d.nom} apportée`}>
                  {[[0, 'aucun'], [0.25, '25 %'], [0.5, '50 %'], [0.75, '75 %'], [1, 'tout']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
            {peutBranche && (<>
              <label style={{ marginTop: 8 }}>Branche d'activité de {fondatrice.nom} apportée : {fP(branche)}</label>
              <input type="range" min="0" max={Math.round(100 * BRANCHE_MAX)} step="5" value={Math.round(branche * 100)} onChange={e => { setBranche(Number(e.target.value) / 100); setErreur(null); }} aria-label="Part de l'activité apportée" />
            </>)}
            <div className="aide" style={{ marginTop: 4 }}>{positions.length > 0 ? "Les titres sont apportés au cours, hors marché, sans commission ni impact sur le prix : la nouvelle société en devient actionnaire et le contrôle qu'ils procurent passe par elle." : ''}{peutBranche ? ` ${fondatrice.nom} peut filialiser jusqu'à ${fP(BRANCHE_MAX)} de son activité : chiffre d'affaires, activité en construction et actifs industriels, à leur valeur de marché ; sa dette reste chez elle.` : ''} Frais de {fP(FRAIS_APPORT_NATURE, 1)} sur la valeur apportée en nature, à couvrir par le numéraire.{type === 'holding' ? ` Une holding étant décotée de ${fP(DECOTE_HOLDING)}, les titres apportés y valent un peu moins que détenus en direct.` : ''}</div>
          </div>
        )}
        {ap && (
          <div className="apercu">
            {ap.valeurNature > 0 && <>
              {ap.valeurTitres > 0 && <div className="ligne"><span>Titres apportés</span><b>{fM(ap.valeurTitres)}</b></div>}
              {ap.branche && <div className="ligne"><span>Branche apportée</span><b>{fM(ap.branche.valeur)} · CA {fM(ap.branche.ca)}</b></div>}
              <div className="ligne"><span>Capital total</span><b>{fM(ap.capitalTotal)}</b></div>
            </>}
            <div className="ligne"><span>Frais de constitution</span><b>{fM(ap.frais)}</b></div>
            {type === 'holding' ? (
              <><div className="ligne"><span>Trésorerie de départ</span><b>{fM(ap.cash)}</b></div>
              {ap.valeurTitres > 0 && <div className="ligne"><span>Valeur de marché à la création</span><b>{fM(ap.valeurInitiale)}</b></div>}</>
            ) : (<>
              <div className="ligne"><span>Actifs industriels</span><b>{fM(ap.actifs)}</b></div>
              <div className="ligne"><span>Trésorerie de départ</span><b>{fM(ap.cash)}</b></div>
              <div className="ligne"><span>Chiffre d'affaires visé</span><b>{fM(ap.caCible)} à marge {fP(ap.champs.margeRef, 1)}</b></div>
              <div className="ligne"><span>Valeur de marché à la création</span><b>{fM(ap.valeurInitiale)}</b></div>
              <div className="ligne"><span>Valeur attendue à maturité</span><b>≈ {fM(ap.valeurMaturite)}, hors conjoncture</b></div>
            </>)}
            <div className="ligne"><span>Détention de départ</span><b>100 % ({fT(ap.actions)} actions à 10 € nominal)</b></div>
          </div>
        )}
        {(erreur || (k > 0 && erreurApercu)) && <div className="erreur">{erreur || erreurApercu}</div>}
        <div className="boutons"><button onClick={onFermer}>Annuler</button><button className="plein" onClick={valider} disabled={!(k > 0)}>Créer</button></div>
      </div>
    </div>
  );
}
