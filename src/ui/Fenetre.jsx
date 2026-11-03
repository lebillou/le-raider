import React, { useState, useMemo } from 'react';
import { AVEC_MONTANT, LIBELLES, calculerApercu, disponible, executerOrdre } from './ordres.jsx';
import { acheter, actives, APPEL_DECOUVERT, BUDGET_RUMEUR_MIN, compteCourant, controlees, couvrir, CROISSANCE_MAX, CROISSANCE_MIN, croissanceDe, DECOTE_PAPIER, DELAI_EMISSION, DELAI_PLAINTE, effortDe, effortMax, estHolding, FRAIS_RESERVEE, IMPOT_PLUS_VALUE, IMPOT_REVENU, JOUEUR, LIBELLE_EFFORT, MANDATS_MAX, MATURITES, MODES_EMISSION, multiple, notation, parametresEffort, PART_PRETABLE, pct, PLAFOND_MARGE, PRIME_NOYAU, RAIDERS, SECT_BY_ID, SEUIL_RETRAIT, TAUX_PRET_TITRES, TYPES_OBLIGATIONS, vendre } from '../engine/index.js';
import { fM, fP, fPts, nf } from './format.js';

export { LIBELLES };

export function Fenetre({ s, action, onFermer, onValider }) {
  const c = s.societes[action.cible];
  const offre = s.offres.find(o => o.cible === c.id);
  const ctrl = useMemo(() => controlees(s), [s]);
  const acteurs = useMemo(() => [JOUEUR, ...[...ctrl].filter(id => id !== c.id)], [ctrl, c.id]);
  const [acteur, setActeur] = useState(action.acteur || JOUEUR);
  const [montant, setMontant] = useState('');
  const [prime, setPrime] = useState(0.3);
  const [numeraire, setNumeraire] = useState(1);
  const numEff = acteur === JOUEUR || !s.societes[acteur] ? 1 : numeraire;
  const [payout, setPayout] = useState(c.payout);
  const [absorbee, setAbsorbee] = useState('');
  const [modeEm, setModeEm] = useState('droits');
  const [souscripteur, setSouscripteur] = useState(JOUEUR);
  const plaignants = useMemo(() => [...ctrl].map(id => s.societes[id]).filter(d => d.active && !estHolding(d) && d.secteur === c.secteur && d.id !== c.id), [ctrl, s, c]);
  const [plaignant, setPlaignant] = useState(() => plaignants[0]?.id || '');
  const [souscrire, setSouscrire] = useState(true);
  const [investisseur, setInvestisseur] = useState(RAIDERS.find(r => s.raiders[r.id].actif)?.id || '');
  const [typeObl, setTypeObl] = useState('classique');
  const [maturite, setMaturite] = useState(7);
  const [croissance, setCroissance] = useState(() => croissanceDe(c));
  const [effort, setEffort] = useState(() => effortDe(c));
  const [erreur, setErreur] = useState(null);
  const m = parseFloat(String(montant).replace(',', '.'));
  const t = action.type;

  const x = { s, c, t, m, acteur, prime, numEff, payout, absorbee, modeEm, souscripteur, plaignant, souscrire, investisseur, typeObl, maturite, croissance, effort, offre, action };
  x.dispo = disponible(x);
  const dispo = x.dispo;
  let apercu = null;
  try { apercu = calculerApercu(x); } catch (e) { apercu = null; }

  const valider = () => {
    try { onValider(executerOrdre(x)); } catch (e) { setErreur(e.message); }
  };

  const filiales = actives(s).filter(d => d.id !== c.id && ctrl.has(d.id));
  const avecMontant = AVEC_MONTANT.includes(t);
  const souscripteurs = [JOUEUR, ...[...ctrl].filter(id => id !== c.id)];
  return (
    <div className="voile" onClick={onFermer}>
      <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h3>{LIBELLES[t]} — {c.nom}</h3>
        {(t === 'acheter' || t === 'opa' || t === 'vendre' || t === 'retrait') && acteurs.length > 1 && (
          <div className="champ"><label>Au nom de</label>
            <select value={acteur} onChange={e => setActeur(e.target.value)}>{acteurs.map(a => <option key={a} value={a}>{a === JOUEUR ? 'Vous' : s.societes[a].nom}</option>)}</select>
          </div>
        )}
        {avecMontant && (
          <div className="champ">
            <label>{t === 'vendre' ? 'Montant à céder (M€)' : t === 'emission' ? 'Montant à lever (M€)' : 'Montant (M€)'} — {t === 'emission' ? 'maximum' : t === 'obligations' ? 'capacité' : 'disponible'} {fM(dispo)}</label>
            <input type="number" inputMode="decimal" min="0" step="0.1" value={montant} onChange={e => { setMontant(e.target.value); setErreur(null); }} autoFocus />
            <div className="raccourcis">{[0.25, 0.5, 1].map(f => <button key={f} onClick={() => setMontant((Math.floor(dispo * f * 10) / 10).toString())}>{fP(f)}</button>)}</div>
          </div>
        )}
        {t === 'opa' && (
          <div className="champ">
            <label>Prime sur le cours : {fP(prime)} — au nom de {acteur === JOUEUR ? 'vous' : s.societes[acteur].nom}, disponible {fM(dispo)}</label>
            <input type="range" min="0" max="100" step="1" value={Math.round(prime * 100)} onChange={e => { setPrime(Number(e.target.value) / 100); setErreur(null); }} />
            <div className="aide" style={{ marginTop: 4 }}>Le flottant répond à la prime ; le noyau dur n'apporte qu'à partir de {fP(PRIME_NOYAU)}. L'offre est garantie : la totalité des titres apportés doit être réglée. Un raider qui estime la cible nettement plus chère peut surenchérir et l'emporter : l'aperçu vous prévient.</div>
          </div>
        )}
        {t === 'opa' && (acteur === JOUEUR ? (
          acteurs.length > 1 && <div className="aide">Pour payer en titres, choisissez « au nom de » une société que vous contrôlez : ce sont ses actions nouvelles qui rémunèrent les apporteurs.</div>
        ) : (
          <div className="champ">
            <label>Paiement : {fP(numEff)} en numéraire, {fP(1 - numEff)} en actions {s.societes[acteur].nom}</label>
            <input type="range" min="0" max="100" step="5" value={Math.round(numEff * 100)} onChange={e => { setNumeraire(Number(e.target.value) / 100); setErreur(null); }} aria-label="Part en numéraire" />
            <div className="raccourcis">{[[1, 'OPA'], [0.5, 'Mixte'], [0, 'OPE']].map(([v, l]) => <button key={l} onClick={() => setNumeraire(v)}>{l}</button>)}</div>
            <div className="aide" style={{ marginTop: 4 }}>Les actionnaires valorisent le papier moins que les espèces : chaque point de paiement en titres retire {fP(DECOTE_PAPIER)} × sa part à la prime perçue. Les actions nouvelles sont émises au cours de {s.societes[acteur].nom} et diluent tous ses actionnaires, vous compris.</div>
          </div>
        ))}
        {t === 'obligations' && (
          <div className="champ">
            <label>Type</label>
            <div className="options">{Object.entries(TYPES_OBLIGATIONS).map(([k, v]) => <button key={k} className={typeObl === k ? 'actif' : ''} onClick={() => { setTypeObl(k); setErreur(null); }}>{v.nom}</button>)}</div>
            <label style={{ marginTop: 8 }}>Maturité</label>
            <div className="options">{MATURITES.map(a => <button key={a} className={maturite === a ? 'actif' : ''} onClick={() => setMaturite(a)}>{a} ans</button>)}</div>
            <div className="aide" style={{ marginTop: 6 }}>{typeObl === 'classique'
              ? "Taux fixe, remboursé en une fois à l'échéance, sans covenant. Réservé aux signatures solides : la dette totale ne peut dépasser 4× l'EBIT. Vous figez votre coût de financement : un bon pari si les taux montent."
              : typeObl === 'hy'
              ? "Le haut rendement finance jusqu'à 6× l'EBIT, bien au-delà de ce que prête la banque, au prix d'un coupon lourd. C'est l'outil des LBO : faire porter une acquisition ou un dividende par la dette de la société."
              : "Coupon réduit, mais si le cours dépasse le prix de conversion à l'échéance, les porteurs deviennent actionnaires : la dette disparaît et le capital est dilué. Une dilution qui peut coûter le contrôle."}
              {' '}À l'échéance, la société rembourse sur sa trésorerie puis tire sur la banque ; si cela ne suffit pas, c'est le défaut : les porteurs convertissent le reliquat en actions à la moitié du cours.</div>
          </div>
        )}
        {t === 'retrait' && <div className="aide" style={{ marginTop: 0 }}>Avec {fP(SEUIL_RETRAIT)} du capital, votre groupe peut exproprier les minoritaires : ils sont indemnisés au plus haut du cours et de la valeur fondamentale, puis {c.nom} quitte la cote. Hors cote, elle est évaluée chaque trimestre à sa valeur fondamentale, sans humeur de marché, et personne ne peut plus y entrer. Elle revient en bourse dès que des titres repassent dans le public.</div>}
        {t === 'decouvert' && <div className="aide" style={{ marginTop: 0 }}>Vous empruntez des titres {c.nom} à des porteurs du flottant et les vendez aussitôt : vous encaissez le produit, et gagnez si le cours baisse d'ici le rachat. Chaque trimestre, vous payez le prêt des titres ({fP(TAUX_PRET_TITRES)} par an de leur valeur) et reversez au prêteur les dividendes versés. La perte n'a pas de plafond : une OPA sur {c.nom} peut faire bondir le cours. Votre courtier limite l'exposition à votre fortune nette et fait racheter d'office, avec une prime, au-delà de {nf(1).format(APPEL_DECOUVERT)} fois ; les prêteurs rappellent leurs titres si le flottant fond. Au plus {fP(PART_PRETABLE)} du flottant est prêtable. Une faillite solde la position sans rien à racheter.</div>}
        {t === 'couvrir' && <div className="aide" style={{ marginTop: 0 }}>Vous rachetez au marché les titres empruntés pour les rendre au prêteur ; le rachat fait monter le cours.</div>}
        {t === 'rumeur' && <div className="aide" style={{ marginTop: 0 }}>Des relais font circuler de fausses nouvelles sur {c.nom} : le cours chute aussitôt, d'autant plus que la société est petite, puis remonte vers sa valeur à mesure que rien ne se confirme. Budget minimum {fM(BUDGET_RUMEUR_MIN)}. À la clôture, l'AMF peut vous démasquer : amende de cinq fois le budget plus 3 % de votre fortune, et démenti qui fait remonter le titre. Le risque croît avec l'ampleur de la baisse et avec chaque rumeur des deux dernières années. Les raiders, eux, achèteront peut-être la baisse.</div>}
        {t === 'plainte' && (plaignants.length ? (
          <div className="champ"><label>Société plaignante (concurrente de {c.nom}, sous votre contrôle)</label>
            <select value={plaignant} onChange={e => { setPlaignant(e.target.value); setErreur(null); }}>{plaignants.map(d => <option key={d.id} value={d.id}>{d.nom} (trésorerie {fM(d.cash)})</option>)}</select>
            <div className="aide" style={{ marginTop: 6 }}>Votre société saisit l'Autorité de la concurrence pour abus de position dominante. Décision dans {DELAI_PLAINTE} trimestres ; les chances dépendent de la part de marché de {c.nom} : quasi nulles sous 10 %, sérieuses au-delà de 30 %. En attendant, l'incertitude pèse sur son cours. Après une décision, plus de nouvelle plainte contre elle pendant deux ans.</div>
          </div>
        ) : <div className="aide" style={{ marginTop: 0 }}>Seule une concurrente peut porter plainte : prenez le contrôle d'une société d'exploitation du secteur {SECT_BY_ID[c.secteur].nom}.</div>)}
        {t === 'compteCourant' && <div className="aide" style={{ marginTop: 0 }}>Vous prêtez à {c.nom} sans recevoir d'actions : votre part ne change pas, les minoritaires ne sont pas dilués. L'avance rapporte le taux directeur + 2 points, versés chaque trimestre et déductibles pour la société ; elle se rembourse quand vous le décidez, si la trésorerie le permet. Subordonnée, elle ne pèse ni sur la notation ni sur la capacité d'emprunt, mais elle est perdue si la société est liquidée.</div>}
        {t === 'rachatObl' && <div className="aide" style={{ marginTop: 0 }}>Rembourser avant l'échéance coûte une pénalité, mais supprime le coupon et le risque de refinancement.</div>}
        {t === 'mandat' && <div className="aide" style={{ marginTop: 0 }}>Le fixe croît avec la taille de la société, dans la limite de 8 % de son EBIT. Le bonus récompense pour moitié la croissance de l'EBIT sur l'année (100 % de la cible à +6,7 %, 150 % à +10 %) et pour moitié la performance boursière contre le marché (100 % à égalité, 0 à −20 points). Chaque année, de nouvelles options au cours du jour, levées au bout de trois ans en actions nouvelles si le cours a monté. Salaire et bonus sont imposés à {fP(IMPOT_REVENU)}, les gains d'options à {fP(IMPOT_PLUS_VALUE)}. Vous perdez le mandat et vos options non acquises si vous perdez le contrôle. Au plus {MANDATS_MAX} présidences. La société paie tout, vous n'en supportez que votre quote-part : un mandat rapporte d'autant plus que votre participation est faible. À 80 % du capital, vous vous payez surtout vous-même, et le fisc prend sa part.</div>}
        {t === 'demission' && <div className="aide" style={{ marginTop: 0 }}>Vous quittez la présidence : le fixe s'arrête et les options non encore acquises sont annulées.</div>}
        {t === 'emission' && (
          <div className="champ"><label>Forme de l'émission</label>
            <select value={modeEm} onChange={e => { setModeEm(e.target.value); setErreur(null); }}>{Object.entries(MODES_EMISSION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            {modeEm === 'droits' && <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, color: 'var(--encre)' }}><input type="checkbox" checked={souscrire} onChange={e => setSouscrire(e.target.checked)} style={{ width: 'auto' }} />Souscrire votre quote-part (sinon vos droits sont vendus)</label>}
            {modeEm === 'reservee' && <select value={souscripteur} onChange={e => { setSouscripteur(e.target.value); setErreur(null); }} style={{ marginTop: 8 }} aria-label="Souscripteur">{souscripteurs.map(h => <option key={h} value={h}>{h === JOUEUR ? 'Vous, en direct' : `${s.societes[h].nom} (trésorerie ${fM(s.societes[h].cash)})`}</option>)}</select>}
            {modeEm === 'prive' && <select value={investisseur} onChange={e => { setInvestisseur(e.target.value); setErreur(null); }} style={{ marginTop: 8 }}>{RAIDERS.filter(r => s.raiders[r.id].actif).map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}</select>}
            <div className="aide" style={{ marginTop: 6 }}>{modeEm === 'public'
              ? "Les actions nouvelles sont vendues au marché. Tous les actionnaires sont dilués ; la décote croît avec la taille de l'émission."
              : modeEm === 'reservee'
              ? `Vous seul souscrivez, directement ou par une société que vous contrôlez : les actions nouvelles sont émises au cours, sans décote, pour ne pas léser les minoritaires, avec ${fP(FRAIS_RESERVEE)} de frais. Les autres actionnaires sont dilués et votre part augmente : c'est la façon la plus directe de financer une filiale et de renforcer votre contrôle.`
              : modeEm === 'droits'
              ? "Chaque actionnaire peut souscrire au prorata de sa part. Qui renonce vend ses droits : la décote est forte, mais elle ne coûte rien à personne. Vos sociétés actionnaires souscrivent si elles ont la trésorerie ; les concurrents, s'ils jugent le prix intéressant."
              : "L'émission est réservée à un groupe de la cote, qui ne souscrit que s'il juge le prix inférieur à la valeur du titre. Il en ressort avec un bloc qui peut vous disputer le contrôle."}
              {' '}Une augmentation de capital au plus tous les {DELAI_EMISSION} trimestres ; elle ne peut pas plus que doubler le nombre d'actions.</div>
          </div>
        )}
        {t === 'payout' && (
          <div className="champ">
            <label>Part du résultat distribuée : {fP(payout)}</label>
            <input type="range" min="0" max="80" step="5" value={Math.round(payout * 100)} onChange={e => setPayout(Number(e.target.value) / 100)} />
          </div>
        )}
        {t === 'strategie' && parametresEffort(c) && (() => {
          const pe = parametresEffort(c);
          const lib = LIBELLE_EFFORT[pe.nature];
          return (
            <div className="champ">
              <label>Croissance visée : {croissance ? `${fPts(croissance)} par an au-delà du secteur` : 'rythme du secteur'}</label>
              <input type="range" min={Math.round(1000 * CROISSANCE_MIN)} max={Math.round(1000 * CROISSANCE_MAX)} step="5" value={Math.round(croissance * 1000)} onChange={e => { setCroissance(Number(e.target.value) / 1000); setErreur(null); }} aria-label="Croissance visée" />
              <label style={{ marginTop: 8 }}>Budget de {lib} : {fP(effort, 1)} du CA (habituel dans le secteur : {fP(pe.norme, 1)})</label>
              <input type="range" min="0" max={Math.round(1000 * effortMax(c))} step="5" value={Math.round(effort * 1000)} onChange={e => { setEffort(Number(e.target.value) / 1000); setErreur(null); }} aria-label={`Budget de ${lib}`} />
              <div className="raccourcis"><button onClick={() => { setCroissance(0); setEffort(pe.norme); setErreur(null); }}>Gestion habituelle</button></div>
              <div className="aide" style={{ marginTop: 6 }}>Gagner des parts de marché se paie en marge (prix, force de vente) : rentable à petite dose, ruineux au-delà de quelques points, et d'autant moins efficace que la société est grande. Y renoncer libère de la marge, mais rapporte moins que la croissance sacrifiée ne vaut.
                {' '}Chaque point de CA consacré {pe.nature === 'rd' ? 'à la R&D' : 'au marketing'} au-delà de l'habitude relève la marge cible {pe.nature === 'rd' ? 'en trois ans environ' : "en un an environ"}, avec une efficacité {pe.efficacite >= 1.2 ? 'élevée' : pe.efficacite >= 0.9 ? 'moyenne' : 'faible'} dans ce secteur et décroissante à l'approche du plafond ({fP(SECT_BY_ID[c.secteur].marge * PLAFOND_MARGE, 1)}). Couper le budget gonfle le résultat publié, le bonus du PDG et la capacité d'emprunt, mais érode la marge cible.
                {' '}Le marché regarde au travers : il valorise l'exploitation avant ces charges et n'en retient que les effets. Une croissance tenue dans la durée lui vaut en revanche un meilleur multiple : jusqu'à +9 % pour 3 points de croissance, crédités en deux ans environ ; y renoncer fait baisser le multiple de même.
                {' '}Le bilan pour l'actionnaire compare les deux politiques : écart de valeur d'exploitation dans cinq ans (marge cible, multiple du jour), moins l'écart de charges cumulées après impôt.</div>
            </div>
          );
        })()}
        {t === 'fusion' && (
          <div className="champ"><label>Société à absorber (parmi celles que vous contrôlez)</label>
            <select value={absorbee} onChange={e => { setAbsorbee(e.target.value); setErreur(null); }}><option value="">—</option>{filiales.map(f => <option key={f.id} value={f.id}>{f.nom} ({c.nom} {fP(pct(f, c.id), 1)}, vous {fP(pct(f, JOUEUR), 1)})</option>)}</select>
            <div className="aide">Tous les actionnaires de l'absorbée autres que {c.nom}, vous compris, reçoivent des titres {c.nom} à la parité des cours. Ses participations sont transférées.</div>
          </div>
        )}
        {apercu && <div className="apercu">{apercu.map(([k, v]) => <div className="ligne" key={k}><span>{k}</span><b>{v}</b></div>)}</div>}
        {erreur && <div className="erreur">{erreur}</div>}
        <div className="boutons">
          <button onClick={onFermer}>Annuler</button>
          <button className="plein" onClick={valider} disabled={avecMontant && !(m > 0)}>Confirmer</button>
        </div>
      </div>
    </div>
  );
}
