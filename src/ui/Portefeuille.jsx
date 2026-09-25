import React, { useMemo } from 'react';
import { creancesComptesCourants, ACQUISITION_OPTIONS, BONUS_CIBLE, JOUEUR, MANDATS_MAX, actives, capi, controlees, detentionEffective, fixeAnnuel, fortune, libelleTour, mandatsDe, titre, valeurPortefeuille } from '../engine/index.js';
import { CourbeFortune } from './Graphiques.jsx';
import { fE, fM, fMp, fP, fT, signe } from './format.js';

export function DetailMandat({ s, c }) {
  const ce = c.ceo;
  if (!ce) return null;
  const valeurOptions = ce.options.reduce((a, o) => a + o.n * Math.max(0, c.prix - o.K), 0);
  const prochaineRevue = 4 - ((s.tour - ce.depuis) % 4 || 4);
  return (
    <div className="grille" style={{ marginBottom: 6, gridTemplateColumns: '1fr' }}>
      <div className="ligne"><span>Fixe annuel</span><b>{fMp(fixeAnnuel(c))}</b></div>
      <div className="ligne"><span>Bonus cible</span><b>{fMp(fixeAnnuel(c) * BONUS_CIBLE)} (0 à 150 %)</b></div>
      <div className="ligne"><span>Dernier bonus</span><b>{ce.dernierBonus ? `${fP(ce.dernierBonus.taux)} de la cible, ${fMp(ce.dernierBonus.montant)}` : 'première revue à venir'}</b></div>
      <div className="ligne"><span>Prochaine revue</span><b>{prochaineRevue === 0 ? 'à la clôture' : `dans ${prochaineRevue} trimestre${prochaineRevue > 1 ? 's' : ''}`}</b></div>
      <div className="ligne"><span>Options en cours</span><b>{ce.options.length ? `${fT(ce.options.reduce((a, o) => a + o.n, 0))}, valeur intrinsèque ${fMp(valeurOptions)}` : 'aucune'}</b></div>
      <div className="ligne"><span>Perçu net depuis {libelleTour(ce.depuis)}</span><b>{fMp(ce.percu)}</b></div>
      {ce.options.map((o, i) => <div className="ligne" key={i}><span>Tranche {libelleTour(o.tour)}</span><b>{fT(o.n)} à {fE(o.K)}, {s.tour - o.tour >= ACQUISITION_OPTIONS ? 'levée à la clôture' : `levée dans ${ACQUISITION_OPTIONS - (s.tour - o.tour)} trim.`}</b></div>)}
    </div>
  );
}

export function Portefeuille({ s, onSel, onCreer }) {
  const ctrl = useMemo(() => controlees(s), [s]);
  const pos = actives(s).filter(c => c.actionnaires[JOUEUR] > 0).sort((a, b) => b.actionnaires[JOUEUR] * b.prix - a.actionnaires[JOUEUR] * a.prix);
  const indirectes = [...ctrl].filter(id => !(s.societes[id].actionnaires[JOUEUR] > 0)).map(id => s.societes[id]);
  const j = s.joueur, f = fortune(s);
  const rendAnnuel = s.tour >= 4 ? Math.pow(Math.max(f, 0.01) / 25, 4 / s.tour) - 1 : null;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}><h2 className="rs" style={{ marginRight: 'auto' }}>Votre fortune</h2>{onCreer && !s.fini && <button onClick={onCreer}>Créer une société</button>}</div>
      <div className="sous">{fM(f)} nets{rendAnnuel !== null ? ` · ${signe(rendAnnuel)} par an depuis le départ` : ''} · titre : {titre(f)}</div>
      <CourbeFortune series={[{ id: JOUEUR, hist: j.histFortune }]} nbTours={s.nbTours} />
      <div className="grille">
        <div className="ligne"><span>Trésorerie</span><b>{fM(j.cash)}</b></div>
        <div className="ligne"><span>Dette sur marge</span><b className={j.marge > 0 ? 'baisse' : ''}>{fM(j.marge)} à {fP(s.taux + 0.02, 1)}</b></div>
        <div className="ligne"><span>Portefeuille direct</span><b>{fM(valeurPortefeuille(s))}</b></div>
        {creancesComptesCourants(s) > 0.005 && <div className="ligne"><span>Comptes courants</span><b>{fM(creancesComptesCourants(s))}</b></div>}
        <div className="ligne"><span>Sociétés contrôlées</span><b>{ctrl.size}</b></div>
        <div className="ligne"><span>Mandats de PDG</span><b>{mandatsDe(s, JOUEUR).length} / {MANDATS_MAX}</b></div>
        <div className="ligne"><span>Rémunérations nettes perçues</span><b>{fMp(s.joueur.remTotale || 0)}</b></div>
      </div>
      {mandatsDe(s, JOUEUR).length > 0 && (<>
        <h3 className="tit">Vos présidences</h3>
        {mandatsDe(s, JOUEUR).map(c => <div key={c.id} style={{ marginBottom: 8 }}><div className="ligne" style={{ cursor: 'pointer' }} onClick={() => onSel(c.id)}><span style={{ color: 'var(--encre)', fontFamily: 'var(--serif)', fontSize: 14 }}>{c.nom}</span><b>fixe {fMp(fixeAnnuel(c))} · perçu {fMp(c.ceo.percu)}</b></div></div>)}
      </>)}
      <h3 className="tit">Positions directes</h3>
      {pos.length === 0 && <div className="vide">Aucune position. La cote vous attend.</div>}
      {pos.map(c => {
        const t = c.actionnaires[JOUEUR], v = t * c.prix;
        return (
          <div className="ligne" key={c.id} style={{ cursor: 'pointer' }} onClick={() => onSel(c.id)}>
            <span style={{ color: 'var(--encre)', fontFamily: 'var(--serif)', fontSize: 14 }}>{c.nom}{ctrl.has(c.id) && <span className="ctrl">ctrl</span>}</span>
            <b>{fP(t / c.actions, 1)} · {fM(v)}</b>
          </div>
        );
      })}
      {indirectes.length > 0 && (<>
        <h3 className="tit">Contrôlées par vos sociétés</h3>
        {indirectes.map(c => <div className="ligne" key={c.id} style={{ cursor: 'pointer' }} onClick={() => onSel(c.id)}><span style={{ color: 'var(--encre)', fontFamily: 'var(--serif)', fontSize: 14 }}>{c.nom}</span><b>{fP(detentionEffective(s, c.id, ctrl), 1)} effectif · {fM(capi(c))}</b></div>)}
      </>)}
    </div>
  );
}
