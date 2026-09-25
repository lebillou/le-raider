import React, { useState, useMemo } from 'react';
import { FRAIS_RESERVEE, apporterCompteCourant, compteCourant, rembourserCompteCourant, tauxCompteCourant, CROISSANCE_MAX, CROISSANCE_MIN, IMPOT, LIBELLE_EFFORT, PLAFOND_MARGE, apercuStrategie, croissanceDe, definirStrategie, effortDe, effortMax, parametresEffort, ACQUISITION_OPTIONS, ANTICIPATION, COUT_RESTRUCTURATION, DECOTE_PAPIER, DELAI_EMISSION, DELAI_RESTRUCTURATION, IMPOT_PLUS_VALUE, IMPOT_REVENU, JOUEUR, MANDATS_MAX, MARGE_MAX, MATURITES, MODES_EMISSION, PENALITE_ANTICIPE, PRIME_NOYAU, RAIDERS, SECT_BY_ID, TYPES_OBLIGATIONS, acheter, actives, apercuAchat, apercuEmission, apercuMandat, apercuOPA, apercuObligations, apercuVente, apporterAOffre, caParEuro, capaciteEmprunt, capaciteObligataire, cederActifs, controlees, dividendeExceptionnel, emettreActions, emettreObligations, emprunter, estHolding, fixeAnnuel, fixerDividende, fusionner, investir, lancerOPA, levier, libelleTour, ltv, montantMaxEmission, multiple, natureOffre, nomDetenteur, nomGroupe, notation, pct, prendreMandat, quitterMandat, racheterActions, rembourser, rembourserObligation, restructurer, resultatNetAnnuel, tauxApport, tauxEmprunt, valeurPortefeuille, vendre } from '../engine/index.js';
import { fE, fM, fMp, fP, fPts, fT, nf } from './format.js';

export const LIBELLES = {
  acheter: 'Acheter des titres', vendre: 'Vendre des titres', opa: 'Lancer une offre',
  emprunter: 'Emprunter', rembourser: 'Rembourser la dette', dividende: 'Dividende exceptionnel',
  rachat: 'Racheter des actions', investir: 'Investir', ceder: 'Céder des actifs',
  restructurer: 'Plan de restructuration', payout: 'Politique de dividende', fusion: 'Absorber une filiale', apporter: "Apporter à l'offre", emission: 'Augmentation de capital', mandat: 'Vous faire élire PDG', strategie: 'Croissance, R&D et marketing', compteCourant: 'Avance en compte courant', rembourserCC: 'Rembourser votre compte courant', obligations: 'Émettre des obligations', rachatObl: 'Rembourser par anticipation', demission: 'Démissionner de la présidence',
};

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
  const [souscrire, setSouscrire] = useState(true);
  const [investisseur, setInvestisseur] = useState(RAIDERS.find(r => s.raiders[r.id].actif)?.id || '');
  const [typeObl, setTypeObl] = useState('classique');
  const [maturite, setMaturite] = useState(7);
  const [croissance, setCroissance] = useState(() => croissanceDe(c));
  const [effort, setEffort] = useState(() => effortDe(c));
  const [erreur, setErreur] = useState(null);
  const m = parseFloat(String(montant).replace(',', '.'));
  const t = action.type;

  const dispo = (() => {
    if (t === 'vendre') return (c.actionnaires[acteur] || 0) * c.prix;
    if (t === 'acheter' || t === 'opa') return acteur === JOUEUR ? s.joueur.cash + Math.max(0, MARGE_MAX * valeurPortefeuille(s) - s.joueur.marge) : s.societes[acteur].cash;
    if (t === 'emprunter') return capaciteEmprunt(c, s);
    if (t === 'compteCourant') return s.joueur.cash + Math.max(0, MARGE_MAX * valeurPortefeuille(s) - s.joueur.marge);
    if (t === 'rembourserCC') return Math.min(c.cash, compteCourant(c));
    if (t === 'emission') return montantMaxEmission(c, modeEm);
    if (t === 'obligations') return capaciteObligataire(s, c, typeObl);
    if (t === 'rembourser') return Math.min(c.cash, c.dette);
    if (t === 'ceder') return c.actifs * 0.6;
    return c.cash;
  })();

  let apercu = null;
  try {
    if (t === 'acheter' && m > 0) { const a = apercuAchat(s, c.id, m); apercu = [['Titres obtenus', fT(a.titres)], ['Prix moyen', fE(a.prixMoyen)], ['Coût total', fM(a.cout)], ['Cours après', fE(a.prixApres)], ['Part acquise', fP(a.pctApres, 1)], ['Flottant restant', fP((a.flottant - a.titres) / c.actions, 1)]]; }
    if (t === 'vendre' && m > 0) { const q = Math.min(m / c.prix, c.actionnaires[acteur] || 0); const a = apercuVente(s, acteur, c.id, q); apercu = [['Titres cédés', fT(a.titres)], ['Prix moyen', fE(a.prixMoyen)], ['Produit net', fM(a.produit)], ['Cours après', fE(a.prixApres)]]; }
    if (t === 'opa') {
      const a = apercuOPA(s, acteur, c.id, prime, numEff);
      const rivaux = RAIDERS.filter(r => c.actionnaires[r.id] > 0 && s.raiders[r.id].actif);
      const init = numEff < 1 ? s.societes[acteur] : null;
      apercu = [
        ['Nature', natureOffre(numEff)],
        ['Valeur offerte par titre', `${fE(a.prixOffre)}${init ? ` = ${numEff > 0 ? fE(a.prixOffre * numEff) + ' + ' : ''}${nf(3).format(a.parite)} ${init.nom}` : ''}`],
        ['Flottant apporté', `${fP(tauxApport(a.primeEff))} · ${fT(a.apportPublic)}`],
        ...(a.noyau > 0 ? [['Noyau dur', a.apportNoyau > 0 ? `apporte ${fT(a.apportNoyau)}` : `refuse (prime effective < ${fP(PRIME_NOYAU)})`]] : []),
        ...rivaux.map(r => [r.nom, a.apportRaiders[r.id] ? `apporte ${fT(a.apportRaiders[r.id])}` : `garde ses ${fP(pct(c, r.id), 1)} (prime effective < ${fP(r.seuilApport)})`]),
        ['Valeur totale', fM(a.valeur)],
        ['Espèces à décaisser', fM(a.cout)],
        ...(init ? [['Titres ' + init.nom + ' émis', `${fT(a.titresEmis)} (${fP(a.dilution, 1)} du capital après)`], ['Votre détention de ' + init.nom, <span className={!a.garderControleInitiateur ? 'alerte-apercu' : ''}>{fP(a.detInitiateurAvant, 1)} → {fP(a.detInitiateurApres, 1)}{!a.garderControleInitiateur ? ` : ${init.nom} passerait sous le contrôle de ${nomGroupe(s, a.controleInitiateurApres)}` : ''}</span>]] : []),
        [`Détention de ${nomDetenteur(s, acteur)} après`, fP(a.detApres, 1)],
        [`Contrôle de ${c.nom} après`, <span className={a.prendControle ? '' : 'alerte-apercu'}>{a.prendControle ? (a.groupe === JOUEUR ? 'vous' : nomGroupe(s, a.groupe)) : nomGroupe(s, a.controleApres)}{!a.prendControle && a.controleApres === null ? ' : pas de contrôle' : ''}</span>],
      ];
    }
    if (t === 'obligations' && m > 0) {
      const a = apercuObligations(s, c.id, { montant: m, maturite, type: typeObl });
      apercu = [
        ['Coupon fixe', `${fP(a.coupon, 2)} pendant ${a.maturite} ans`],
        ['Crédit bancaire au taux du jour', `${fP(a.tauxBanque, 2)}, variable`],
        ['Charge annuelle', fM(a.chargeAnnuelle)],
        ['Produit net de frais', fM(a.net)],
        ['Notation après', a.note],
        [estHolding(c) ? 'LTV après' : 'Levier après', estHolding(c) ? fP(a.ltvApres) : nf(1).format(a.levierApres) + '× l\'EBIT'],
        ['Échéance', `${libelleTour(a.echeance)} : ${fM(a.montant)} à rembourser ou refinancer`],
        ...(a.prixConversion ? [['Prix de conversion', `${fE(a.prixConversion)} (cours ${fE(c.prix)})`], ['Dilution si conversion', `${fT(a.titresPotentiels)}, ${fP(a.dilutionPotentielle, 1)} du capital`]] : []),
        ...(a.depasse ? [['Refus', <span className="alerte-apercu">au-delà de {fM(a.capacite)}, les investisseurs ne suivent pas</span>]] : []),
      ];
    }
    if (t === 'rachatObl') {
      const o = (c.obligations || []).find(x => x.id === action.obligId);
      if (o) apercu = [['Nominal', fM(o.nominal)], ['Pénalité', fP(PENALITE_ANTICIPE[o.type])], ['Coût total', fM(o.nominal * (1 + PENALITE_ANTICIPE[o.type]))], ['Coupon économisé', `${fM(o.nominal * o.coupon)} par an`], ['Trésorerie disponible', fM(c.cash)]];
    }
    if (t === 'mandat') {
      const a = apercuMandat(s, c.id);
      apercu = [
        ['Fixe annuel', `${fMp(a.fixe)} (versé chaque trimestre)`],
        ['Bonus annuel', `cible ${fMp(a.bonus)}, de 0 à ${fMp(a.bonusMax)}`],
        ['Stock-options par an', `${fT(a.options)} au cours du jour (${fE(a.strike)} aujourd'hui), levables après ${ACQUISITION_OPTIONS / 4} ans`],
        ['Coût annuel pour la société', fMp(a.cout)],
        ['Votre revenu net à la cible', `${fMp(a.revenuNet)} par an, après impôt`],
        ['Votre part du coût, comme actionnaire', `${fMp(a.quotePart)} par an (détention ${fP(a.det, 1)})`],
        ['Gain net pour vous', <span className={a.gainNet < 0 ? 'alerte-apercu' : ''}>{fMp(a.gainNet)} par an{a.gainNet < 0 ? ' : vous payez plus que vous ne touchez' : ''}</span>],
        ['Mandats', `${a.mandats} / ${MANDATS_MAX}`],
      ];
    }
    if (t === 'demission' && c.ceo) {
      const nonAcquises = c.ceo.options.filter(o => s.tour - o.tour < ACQUISITION_OPTIONS);
      apercu = [['Fixe perdu', `${fMp(fixeAnnuel(c))} par an`], ['Options annulées', nonAcquises.length ? `${fT(nonAcquises.reduce((x, o) => x + o.n, 0))}, valeur intrinsèque ${fMp(nonAcquises.reduce((x, o) => x + o.n * Math.max(0, c.prix - o.K), 0))}` : 'aucune']];
    }
    if (t === 'emission' && m > 0) {
      const a = apercuEmission(s, c.id, { montant: m, mode: modeEm, souscrireJoueur: souscrire, investisseur, souscripteur });
      apercu = a.vide ? [['Résultat', 'aucune souscription'], ...a.decisions] : [
        ["Prix d'émission", `${fE(a.prixEm)} (décote ${fP(a.decote, 1)})`],
        ['Actions nouvelles', `${fT(a.n)} (${fP(a.dilution, 1)} du capital après)`],
        ['Levée nette de frais', fM(a.net)],
        ['Cours théorique après', fE(a.terp)],
        ...a.decisions,
        ...(a.coutJoueur > 0 ? [['Vous payez', fM(a.coutJoueur)]] : []),
        ...(a.droitsJoueur > 0 ? [['Vous encaissez (droits)', fM(a.droitsJoueur)]] : []),
        ['Votre détention effective', `${fP(a.detAvant, 1)} → ${fP(a.detApres, 1)}`],
        ['Contrôle après', <span className={a.controleApres === JOUEUR ? '' : 'alerte-apercu'}>{a.controleApres === JOUEUR ? 'vous' : nomGroupe(s, a.controleApres)}{a.controleApres !== JOUEUR ? ' : vous perdriez le contrôle' : ''}</span>],
      ];
    }
    if (t === 'apporter' && offre) { const q = c.actionnaires[JOUEUR] || 0; apercu = [['Prix offert', fE(offre.prixOffre)], ['Cours actuel', fE(c.prix)], ['Titres apportés', fT(q)], ['Produit brut', fM(q * offre.prixOffre)]]; }
    if (t === 'rachat' && m > 0) { const a = apercuAchat(s, c.id, m); apercu = [['Titres annulés', fT(a.titres)], ['Prix moyen', fE(a.prixMoyen)], ['Coût', fM(a.cout)], ['Flottant après', fP((a.flottant - a.titres) / (c.actions - a.titres), 1)]]; }
    if (t === 'emprunter' && m > 0) { const d = { ...c, dette: c.dette + m, cash: c.cash + m }; apercu = [['Dette après', fM(d.dette)], estHolding(c) ? ['LTV après', fP(ltv(s, d))] : ['Levier après', nf(1).format(levier(d)) + '×'], ['Notation après', notation(d, s)], ['Intérêts annuels', fM(d.dette * tauxEmprunt(s, d))]]; }
    if (t === 'rembourser' && m > 0) { const d = { ...c, dette: Math.max(0, c.dette - m), cash: c.cash - Math.min(m, c.dette) }; apercu = [['Dette après', fM(d.dette)], ['Notation après', notation(d, s)]]; }
    if (t === 'dividende' && m > 0) apercu = [['Par action', fE(m / c.actions)], ['Pour vous (direct)', fM(m * pct(c, JOUEUR))], ['Trésorerie après', fM(c.cash - m)]];
    if (t === 'investir' && m > 0) { const g = m * caParEuro(c.secteur); apercu = [['Actifs après', fM(c.actifs + m)], ['CA supplémentaire', `${fM(g)} d'ici deux ans`], ['EBIT supplémentaire à maturité', fM(g * c.margeRef)], ['Valeur de marché immédiate', `≈ ${fM(ANTICIPATION * g * c.margeRef * multiple(s, c))} pour ${fM(m)} investis`]]; }
    if (t === 'ceder' && m > 0) { const mm = Math.min(m, c.actifs * 0.6); apercu = [['Produit (décote 15 %)', fM(mm * 0.85)], ['CA après', fM(Math.max(c.ca - mm * c.rot, c.ca * 0.3))]]; }
    if (t === 'restructurer') apercu = [['Coût', fM(COUT_RESTRUCTURATION * c.ca)], ['Marge cible', `${fP(c.margeRef, 1)} → ${fP(Math.min(c.margeRef * 1.15, SECT_BY_ID[c.secteur].marge * 1.6), 1)}`], ['Prochain plan', `dans ${DELAI_RESTRUCTURATION} trimestres`]];
    if (t === 'strategie') {
      const a = apercuStrategie(s, c.id, { croissance, effort });
      const valeur = (p) => p.ca * p.margeCible * multiple(s, c);   // effets encore en gestation compris
      const net = valeur(a.nouvelle) - valeur(a.actuelle) - (a.nouvelle.charges - a.actuelle.charges) * (1 - IMPOT);
      const fleche = (x, y, f) => x === y || Math.abs(x - y) < 1e-9 ? f(y) : `${f(x)} → ${f(y)}`;
      apercu = [
        ['Charges stratégiques', <>{fleche(a.chargeAvant, a.chargeApres, fM)} par an{a.chargeApres < -1e-6 ? ' (économie)' : ''}</>],
        ['Marge publiée', `${fleche(a.margePublieeAvant, a.margePublieeApres, (v) => fP(v, 1))} (exploitation ${fP(c.marge, 1)})`],
        ['EBIT publié', fleche(a.ebitPublieAvant, a.ebitPublieApres, fM)],
        [`Dans ${a.ans} ans, CA`, `${fM(a.actuelle.ca)} → ${fM(a.nouvelle.ca)}`],
        [`Dans ${a.ans} ans, marge cible`, `${fP(a.actuelle.margeCible, 1)} → ${fP(a.nouvelle.margeCible, 1)}`],
        [`Dans ${a.ans} ans, EBIT publié`, `${fM(a.actuelle.ebitPublie)} → ${fM(a.nouvelle.ebitPublie)}`],
        [`Charges cumulées sur ${a.ans} ans`, `${fM(a.actuelle.charges)} → ${fM(a.nouvelle.charges)}`],
        [`Bilan à ${a.ans} ans pour l'actionnaire`, <span className={net < 0 ? 'alerte-apercu' : ''}>{net >= 0 ? '+' : ''}{fM(net)}</span>],
      ];
    }
    if (t === 'compteCourant' && m > 0) apercu = [['Trésorerie de ' + c.nom + ' après', fM(c.cash + m)], ['Votre créance après', fM(compteCourant(c) + m)], ['Intérêts annuels', `${fM((compteCourant(c) + m) * tauxCompteCourant(s))} à ${fP(tauxCompteCourant(s), 2)}, taux variable`], ['Votre détention', `${fP(pct(c, JOUEUR), 1)}, inchangée`], ...(m > s.joueur.cash + 1e-9 ? [['Financement', <span className="alerte-apercu">{fM(m - s.joueur.cash)} tirés sur votre marge</span>]] : [])];
    if (t === 'rembourserCC' && m > 0) { const mm = Math.min(m, compteCourant(c)); apercu = [['Remboursé', fM(mm)], ['Reste dû', fM(compteCourant(c) - mm)], ['Trésorerie de ' + c.nom + ' après', fM(c.cash - mm)]]; }
    if (t === 'payout') apercu = [['Dividende annuel estimé', fM(Math.max(0, resultatNetAnnuel(s, c)) * payout)], ['Dont pour vous (direct)', fM(Math.max(0, resultatNetAnnuel(s, c)) * payout * pct(c, JOUEUR))]];
    if (t === 'fusion' && absorbee) { const b = s.societes[absorbee]; const emis = (b.actions - (b.actionnaires[c.id] || 0)) * b.prix / c.prix; const recus = (b.actionnaires[JOUEUR] || 0) * b.prix / c.prix; apercu = [['Parité', `${nf(3).format(b.prix / c.prix)} ${c.nom} par ${b.nom}`], ['Titres émis', `${fT(emis)} (dont ${fT(recus)} pour vous)`], ['Votre part de ' + c.nom, `${fP(pct(c, JOUEUR), 1)} → ${fP(((c.actionnaires[JOUEUR] || 0) + recus) / (c.actions + emis - (c.actionnaires[b.id] || 0)), 1)}`], ['CA consolidé', fM(c.ca + b.ca)], ['Dette consolidée', fM(c.dette + b.dette)], ['Synergies', b.secteur === c.secteur ? 'même secteur : marge +8 %' : 'aucune (secteurs différents)']]; }
  } catch (e) { apercu = null; }

  const valider = () => {
    try {
      let n;
      if (t === 'acheter') n = acheter(s, acteur, c.id, m);
      else if (t === 'vendre') n = vendre(s, acteur, c.id, Math.min(m / c.prix, c.actionnaires[acteur] || 0));
      else if (t === 'opa') n = lancerOPA(s, acteur, c.id, prime, numEff);
      else if (t === 'emprunter') n = emprunter(s, c.id, m);
      else if (t === 'rembourser') n = rembourser(s, c.id, m);
      else if (t === 'dividende') n = dividendeExceptionnel(s, c.id, m);
      else if (t === 'rachat') n = racheterActions(s, c.id, m);
      else if (t === 'investir') n = investir(s, c.id, m);
      else if (t === 'ceder') n = cederActifs(s, c.id, m);
      else if (t === 'restructurer') n = restructurer(s, c.id);
      else if (t === 'payout') n = fixerDividende(s, c.id, payout);
      else if (t === 'fusion') { if (!absorbee) throw new Error('Choisissez la société à absorber.'); n = fusionner(s, c.id, absorbee); }
      else if (t === 'apporter') n = apporterAOffre(s, c.id);
      else if (t === 'emission') n = emettreActions(s, c.id, { montant: m, mode: modeEm, souscrireJoueur: souscrire, investisseur, souscripteur });
      else if (t === 'compteCourant') n = apporterCompteCourant(s, c.id, m);
      else if (t === 'rembourserCC') n = rembourserCompteCourant(s, c.id, m);
      else if (t === 'mandat') n = prendreMandat(s, c.id);
      else if (t === 'obligations') n = emettreObligations(s, c.id, { montant: m, maturite, type: typeObl });
      else if (t === 'rachatObl') n = rembourserObligation(s, c.id, action.obligId);
      else if (t === 'demission') n = quitterMandat(s, c.id);
      else if (t === 'strategie') n = definirStrategie(s, c.id, { croissance, effort });
      onValider(n);
    } catch (e) { setErreur(e.message); }
  };

  const filiales = actives(s).filter(d => d.id !== c.id && ctrl.has(d.id));
  const avecMontant = ['acheter', 'vendre', 'emprunter', 'rembourser', 'dividende', 'rachat', 'investir', 'ceder', 'emission', 'obligations', 'compteCourant', 'rembourserCC'].includes(t);
  const souscripteurs = [JOUEUR, ...[...ctrl].filter(id => id !== c.id)];
  return (
    <div className="voile" onClick={onFermer}>
      <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h3>{LIBELLES[t]} — {c.nom}</h3>
        {(t === 'acheter' || t === 'opa' || t === 'vendre') && acteurs.length > 1 && (
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
            <div className="aide" style={{ marginTop: 4 }}>Le flottant répond à la prime ; le noyau dur n'apporte qu'à partir de {fP(PRIME_NOYAU)}. L'offre est garantie : la totalité des titres apportés doit être réglée.</div>
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
                {' '}Le marché regarde au travers : il valorise l'exploitation avant ces charges et n'en retient que les effets.
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
