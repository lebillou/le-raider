import React, { useMemo } from 'react';
import { ANTICIPATION, COUT_RESTRUCTURATION, LIBELLE_EFFORT, chargeStrategique, croissanceDe, effortDe, parametresEffort, DECOTE_HOLDING, DELAI_EMISSION, DELAI_RESTRUCTURATION, JOUEUR, MARGE_MAX, PRIME_NOYAU, SECT_BY_ID, SEUIL_CONTROLE, SEUIL_RELATIF, TYPES_OBLIGATIONS, actives, blocsDeVote, capaciteEmprunt, capi, controlees, couponsAnnuels, detentionEffective, detteObligataire, ebitAnnuel, estHolding, estRaider, levier, libelleTour, ltv, natureControle, nomDetenteur, nomGroupe, notation, pct, per, repartitionControle, resultatNetAnnuel, tauxEmprunt, valeurParticipations, valeurPortefeuille } from '../engine/index.js';
import { Spark } from './Graphiques.jsx';
import { DetailMandat } from './Portefeuille.jsx';
import { classeVar, fE, fM, fP, fPts, fT, nf, signe } from './format.js';

export function Actionnaires({ s, c, ctrl }) {
  const entrees = Object.entries(c.actionnaires).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      {entrees.map(([h, t]) => {
        const f = t / c.actions;
        const nom = h === 'noyau' ? 'Noyau dur (familial)' : nomDetenteur(s, h);
        const societeH = h !== 'public' && h !== 'noyau' && h !== JOUEUR && !estRaider(s, h);
        const cls = h === JOUEUR ? 'vous' : h === 'noyau' ? 'noy' : '';
        return (
          <div className="part" key={h}>
            <span style={{ fontFamily: societeH || estRaider(s, h) ? 'var(--serif)' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}{societeH && ctrl.has(h) && <span className="ctrl">ctrl</span>}</span>
            <div className="barre"><i className={cls} style={{ width: `${100 * f}%` }} /></div>
            <em>{fP(f, 1)}</em>
          </div>
        );
      })}
    </div>
  );
}

export function Societe({ s, id, onAction, onSel }) {
  const c = s.societes[id];
  const ctrl = useMemo(() => controlees(s), [s]);
  if (!c) return <div className="vide">Choisissez une société dans la cote.</div>;
  if (!c.active) return <div><h2 className="rs">{c.nom}</h2><div className="tampon">{c.faillite ? 'Liquidée' : 'Absorbée'}</div>{c.absorbeePar && <p>Absorbée par <button onClick={() => onSel(c.absorbeePar)}>{s.societes[c.absorbeePar].nom}</button></p>}</div>;
  const sec = SECT_BY_ID[c.secteur], ebit = ebitAnnuel(c), rn = resultatNetAnnuel(s, c), p = per(s, c);
  const det = detentionEffective(s, c.id, ctrl), estCtrl = ctrl.has(c.id);
  const rendement = c.dernierDiv !== undefined ? (c.dernierDiv * 4) / c.prix : (rn > 0 ? rn * c.payout / capi(c) : 0);
  const varAn = c.hist.length > 4 ? c.prix / c.hist[c.hist.length - 5] - 1 : c.prix / c.hist[0] - 1;
  const filiales = actives(s).filter(d => d.id !== c.id && ctrl.has(d.id));
  const offre = s.offres.find(o => o.cible === c.id);
  const parts = actives(s).filter(d => d.id !== c.id && (d.actionnaires[c.id] || 0) > 0);
  const dispoJ = s.joueur.cash + Math.max(0, MARGE_MAX * valeurPortefeuille(s) - s.joueur.marge);
  const hold = estHolding(c);
  const ctl = repartitionControle(s);
  const ctlG = ctl[c.id] || null;
  const monGroupe = JOUEUR;
  const rival = Object.entries(blocsDeVote(s, c, ctl)).filter(([g]) => g !== monGroupe).sort((a, b) => b[1] - a[1])[0] || null;
  const vPart = valeurParticipations(s, c.id);
  const anr = vPart + c.cash - c.dette;
  const charge = c.caPipeline > 0.01 ? c.ca / (c.ca + c.caPipeline) : 1;
  const pe = parametresEffort(c), dg = croissanceDe(c), latente = c.margeLatente || 0;
  return (
    <div>
      <h2 className="rs">{c.nom}{estCtrl && <span className="ctrl" style={{ fontSize: 12, verticalAlign: 'middle', marginLeft: 8 }}>sous votre contrôle</span>}{c.creePar && <span className="cree">créée en {libelleTour(c.creeAu)}</span>}</h2>
      <div className="sous">{sec.nom} · notation {notation(c, s)} · {fE(c.prix)} <span className={classeVar(varAn)}>({signe(varAn)} sur un an)</span> <Spark hist={c.hist} w={90} h={20} />{c.ceo && <> · PDG : {c.ceo.h === JOUEUR ? 'vous' : nomDetenteur(s, c.ceo.h)}</>}</div>
      {hold ? (
      <div className="grille">
        <div className="ligne"><span>Capitalisation</span><b>{fM(capi(c))}</b></div>
        <div className="ligne"><span>Actions</span><b>{fT(c.actions)}</b></div>
        <div className="ligne"><span>Participations (au cours)</span><b>{fM(vPart)}</b></div>
        <div className="ligne"><span>Trésorerie</span><b>{fM(c.cash)}</b></div>
        <div className="ligne"><span>Dette bancaire</span><b>{fM(c.dette)}</b></div>
        {detteObligataire(c) > 0 && <div className="ligne"><span>Dette obligataire</span><b>{fM(detteObligataire(c))}</b></div>}
        <div className="ligne"><span>Actif net réévalué</span><b className={classeVar(anr)}>{fM(anr)}</b></div>
        <div className="ligne"><span>Décote sur ANR</span><b>{anr > 0 ? fP(1 - capi(c) / anr) : '—'}</b></div>
        <div className="ligne"><span>LTV (dette / actifs)</span><b className={ltv(s, c) > 0.5 ? 'baisse' : ''}>{fP(Math.min(ltv(s, c), 9))}</b></div>
        <div className="ligne"><span>Coût de la dette</span><b>{fP(tauxEmprunt(s, c), 1)}</b></div>
        <div className="ligne"><span>Dividendes reçus (rythme)</span><b>{fM(4 * (c.divRecus || 0))}</b></div>
        <div className="ligne"><span>Distribution</span><b>{fP(c.payout)} du résultat</b></div>
      </div>
      ) : (
      <div className="grille">
        <div className="ligne"><span>Capitalisation</span><b>{fM(capi(c))}</b></div>
        <div className="ligne"><span>Actions</span><b>{fT(c.actions)}</b></div>
        <div className="ligne"><span>Chiffre d'affaires</span><b>{fM(c.ca)}</b></div>
        {c.caPipeline > 0.01 && <div className="ligne"><span>CA en construction</span><b>{fM(c.caPipeline)} ({fP(charge)} en service)</b></div>}
        <div className="ligne"><span>Marge d'exploitation</span><b>{fP(c.marge, 1)}{Math.abs(chargeStrategique(c)) > 1e-6 && <> · publiée {fP(c.marge - chargeStrategique(c), 1)}</>}</b></div>
        <div className="ligne"><span>Marge cible</span><b>{fP(c.margeRef, 1)}{Math.abs(latente) > 0.0005 && <> ({fPts(latente)} en gestation)</>}</b></div>
        <div className="ligne"><span>Croissance visée</span><b>{dg ? `${fPts(dg)} par an sur le secteur` : 'rythme du secteur'}</b></div>
        <div className="ligne"><span>Budget de {LIBELLE_EFFORT[pe.nature]}</span><b>{fP(effortDe(c), 1)} du CA (norme {fP(pe.norme, 1)})</b></div>
        <div className="ligne"><span>EBIT annuel publié</span><b className={classeVar(ebit)}>{fM(ebit)}</b></div>
        <div className="ligne"><span>Résultat net (rythme)</span><b className={classeVar(rn)}>{fM(rn)}</b></div>
        <div className="ligne"><span>PER</span><b>{p ? nf(1).format(p) : '—'}</b></div>
        <div className="ligne"><span>Rendement</span><b>{fP(rendement, 1)}</b></div>
        <div className="ligne"><span>Trésorerie</span><b>{fM(c.cash)}</b></div>
        <div className="ligne"><span>Dette bancaire</span><b>{fM(c.dette)}</b></div>
        {detteObligataire(c) > 0 && <div className="ligne"><span>Dette obligataire</span><b>{fM(detteObligataire(c))}</b></div>}
        <div className="ligne"><span>Actifs</span><b>{fM(c.actifs)}</b></div>
        <div className="ligne"><span>Levier dette totale/EBIT</span><b className={levier(c) > 4 ? 'baisse' : ''}>{levier(c) > 50 ? '∞' : nf(1).format(levier(c)) + '×'}</b></div>
        <div className="ligne"><span>Coût de la dette</span><b>{fP(tauxEmprunt(s, c), 1)}</b></div>
        <div className="ligne"><span>Distribution</span><b>{fP(c.payout)} du résultat</b></div>
        {parts.length > 0 && <div className="ligne"><span>Participations</span><b>{fM(valeurParticipations(s, c.id))}</b></div>}
      </div>
      )}
      {c.caPipeline > 0.01 && !hold && <div className="aide" style={{ marginTop: 6 }}>Montée en charge : {fP(charge)} de l'activité en service. Le marché valorise déjà {fP(ANTICIPATION)} de l'activité en construction ; la valeur complète se révèle en deux ans environ.<div className="barre-charge"><i style={{ width: `${100 * charge}%` }} /></div></div>}
      {hold && <div className="aide" style={{ marginTop: 6 }}>Une holding vaut son actif net, que le marché décote de {fP(DECOTE_HOLDING)} environ. Elle emprunte jusqu'à 50 % de la valeur de ses participations ; au-delà de 75 % de LTV, la banque fait céder des blocs.</div>}

      <h3 className="tit">Capital</h3>
      <Actionnaires s={s} c={c} ctrl={ctrl} />
      {det > 0.0005 && <div className="sous" style={{ marginTop: 6 }}>Votre détention effective, directe et via vos sociétés : {fP(det, 1)}.</div>}
      <div className="sous" style={{ marginTop: 4 }}>{ctlG ? <>Contrôlée par <b>{nomGroupe(s, ctlG)}</b> ({natureControle(s, c.id, ctl) === 'majorite' ? 'majorité absolue' : 'majorité relative : 25 % au moins, sans autre bloc de 25 %'}).</> : <>Aucun actionnaire ne la contrôle.</>}</div>
      {offre && !s.fini && c.actionnaires[JOUEUR] > 0 && (
        <div className="offre">Offre en cours de {nomDetenteur(s, offre.acteur)} à {fE(offre.prixOffre)} par titre (cours {fE(c.prix)}), valable jusqu'à la clôture du trimestre. Vos {fT(c.actionnaires[JOUEUR])} titres vaudraient {fM(c.actionnaires[JOUEUR] * offre.prixOffre)}.
          <div className="actions" style={{ margin: '8px 0 0' }}><button className="plein" onClick={() => onAction({ type: 'apporter', cible: c.id })}>Apporter vos titres à l'offre</button></div>
        </div>
      )}
      {!s.fini && (
        <div className="actions">
          <button className="plein" onClick={() => onAction({ type: 'acheter', cible: c.id })}>Acheter</button>
          <button disabled={!(c.actionnaires[JOUEUR] > 0) && !ctrl.size} onClick={() => onAction({ type: 'vendre', cible: c.id })}>Vendre</button>
          <button onClick={() => onAction({ type: 'opa', cible: c.id })}>Lancer une offre (OPA, OPE)</button>
        </div>
      )}
      {!estCtrl && !s.fini && <div className="aide">Contrôler une société demande 50 % des droits de vote, ou 25 % si aucun autre bloc n'atteint 25 %.{rival ? ` Ici, ${nomGroupe(s, rival[0])} pèse ${fP(rival[1] / c.actions, 1)} : ${rival[1] / c.actions >= SEUIL_RELATIF ? `il vous faudra ${fM(SEUIL_CONTROLE * capi(c))} (50 %) au cours actuel, ou le faire sortir` : `${fM(SEUIL_RELATIF * capi(c))} (25 %) suffisent au cours actuel`}.` : ` Aucun bloc constitué : ${fM(SEUIL_RELATIF * capi(c))} (25 %) suffisent au cours actuel.`} Vous disposez de {fM(dispoJ)} (trésorerie et marge). {c.actionnaires.noyau ? `Le noyau dur (${fP(pct(c, 'noyau'))}) ne cède qu'à une OPA avec au moins ${fP(PRIME_NOYAU)} de prime.` : ''}</div>}

      {parts.length > 0 && (<>
        <h3 className="tit">Participations détenues</h3>
        {parts.map(d => <div className="ligne" key={d.id}><span><button onClick={() => onSel(d.id)} style={{ border: 0, padding: 0, fontFamily: 'var(--serif)', fontSize: 14 }}>{d.nom}</button></span><b>{fP(pct(d, c.id), 1)} · {fM(d.actionnaires[c.id] * d.prix)}</b></div>)}
      </>)}

      {(c.obligations || []).length > 0 && (<>
        <h3 className="tit">Obligations en circulation</h3>
        {c.obligations.map(o => (
          <div className="ligne" key={o.id}>
            <span>{TYPES_OBLIGATIONS[o.type].nom}, {fM(o.nominal)}</span>
            <b style={{ whiteSpace: 'normal', textAlign: 'right' }}>coupon {fP(o.coupon, 2)} · échéance {libelleTour(o.echeance)} ({o.echeance - s.tour} trim.){o.prixConversion ? ` · conversion à ${fE(o.prixConversion)}` : ''}
              {estCtrl && !s.fini && <> <button style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => onAction({ type: 'rachatObl', cible: c.id, obligId: o.id })}>Rembourser</button></>}</b>
          </div>
        ))}
        <div className="sous" style={{ marginTop: 4 }}>Coupons annuels : {fM(couponsAnnuels(c))}, contre {fM(c.dette * tauxEmprunt(s, c))} d'intérêts bancaires au taux du jour.</div>
      </>)}
      {c.ceo && c.ceo.h === JOUEUR && (<>
        <h3 className="tit">Votre mandat de PDG</h3>
        <DetailMandat s={s} c={c} />
        {!s.fini && <div className="actions"><button onClick={() => onAction({ type: 'demission', cible: c.id })}>Démissionner</button></div>}
      </>)}
      {estCtrl && !s.fini && (<>
        <h3 className="tit">Pilotage</h3>
        <div className="aide" style={{ marginTop: 0, marginBottom: 8 }}>Capacité d'emprunt : {fM(capaciteEmprunt(c, s))}.{!hold && <> Plan de restructuration : {fM(COUT_RESTRUCTURATION * c.ca)}{c.derniereRestructuration !== undefined && s.tour - c.derniereRestructuration < DELAI_RESTRUCTURATION ? `, disponible dans ${DELAI_RESTRUCTURATION - (s.tour - c.derniereRestructuration)} trimestres` : ''}.</>}</div>
        <div className="actions">
          <button onClick={() => onAction({ type: 'emprunter', cible: c.id })}>Emprunter</button>
          <button onClick={() => onAction({ type: 'rembourser', cible: c.id })} disabled={c.dette < 0.05}>Rembourser</button>
          <button onClick={() => onAction({ type: 'dividende', cible: c.id })}>Dividende exceptionnel</button>
          <button onClick={() => onAction({ type: 'rachat', cible: c.id })}>Racheter des actions</button>
          {!hold && <button onClick={() => onAction({ type: 'investir', cible: c.id })}>Investir</button>}
          {!hold && <button onClick={() => onAction({ type: 'ceder', cible: c.id })}>Céder des actifs</button>}
          {!hold && <button onClick={() => onAction({ type: 'restructurer', cible: c.id })}>Restructurer</button>}
          {!hold && <button onClick={() => onAction({ type: 'strategie', cible: c.id })}>Croissance et {LIBELLE_EFFORT[pe.nature]}</button>}
          <button onClick={() => onAction({ type: 'payout', cible: c.id })}>Politique de dividende</button>
          <button onClick={() => onAction({ type: 'emission', cible: c.id })} disabled={c.derniereEmission !== undefined && s.tour - c.derniereEmission < DELAI_EMISSION}>Augmentation de capital</button>
          <button onClick={() => onAction({ type: 'obligations', cible: c.id })} disabled={c.derniereObligation === s.tour}>Émettre des obligations</button>
          {!c.ceo && <button onClick={() => onAction({ type: 'mandat', cible: c.id })}>Vous faire élire PDG</button>}
          <button onClick={() => onAction({ type: 'fusion', cible: c.id })} disabled={!filiales.length}>Absorber une filiale</button>
        </div>
        <div className="aide">Pour acheter ou lancer une offre au nom de {c.nom}, ouvrez la société visée et choisissez « au nom de » dans la fenêtre d'ordre ; une offre au nom de {c.nom} peut être payée en actions {c.nom} nouvelles. {filiales.length ? `Absorbables (sociétés que vous contrôlez, directement ou via vos filiales) : ${filiales.map(f => f.nom).join(', ')}.` : ''}</div>
      </>)}
    </div>
  );
}
