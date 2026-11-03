// Calculs des fenêtres d'ordre, séparés de leur affichage : disponible, aperçu, exécution.
// Chaque fonction reçoit le contexte de la fenêtre (état, société, type d'ordre et valeurs saisies).
import React from 'react';
import { IMPOT_DIVIDENDES, fiscaliteActive, netDeRevenu, adopterBons, apercuBons, retirerBons, acheter, ACQUISITION_OPTIONS, ANTICIPATION, apercuAchat, apercuCouverture, apercuEmission, apercuMandat, apercuObligations, apercuOPA, apercuPlainte, apercuRetrait, apercuRumeur, apercuStrategie, apercuVente, apercuVenteDecouvert, apporterAOffre, apporterCompteCourant, capaciteDecouvert, capaciteEmprunt, capaciteObligataire, caParEuro, cederActifs, compteCourant, coutRestructuration, couvrir, definirStrategie, DELAI_RESTRUCTURATION, dividendeExceptionnel, emettreActions, emettreObligations, emprunter, estHolding, facteurCroissance, fixeAnnuel, fixerDividende, FRAIS_OFFRE_CADUQUE, fusionner, IMPOT, investir, JOUEUR, lancerOPA, lancerRumeur, levier, libelleTour, ltv, MANDATS_MAX, MARGE_MAX, margeApresRestructuration, montantAvantOffre, montantMaxEmission, multiple, natureOffre, nomDetenteur, nomGroupe, notation, pct, PENALITE_ANTICIPE, porterPlainte, positionsCourtes, prendreMandat, pretable, PRIME_NOYAU, primeDissuasive, quitterMandat, racheterActions, RAIDERS, rembourser, rembourserCompteCourant, rembourserObligation, restructurer, resultatNetAnnuel, retraitObligatoire, TAUX_PRET_TITRES, tauxApport, tauxCompteCourant, tauxEmprunt, valeurPortefeuille, vendre, vendreADecouvert } from '../engine/index.js';
import { fE, fM, fMp, fP, fT, nf } from './format.js';

export const LIBELLES = {
  acheter: 'Acheter des titres', vendre: 'Vendre des titres', opa: 'Lancer une offre',
  emprunter: 'Emprunter', rembourser: 'Rembourser la dette', dividende: 'Dividende exceptionnel',
  rachat: 'Racheter des actions', investir: 'Investir', ceder: 'Céder des actifs',
  restructurer: 'Plan de restructuration', payout: 'Politique de dividende', fusion: 'Absorber une filiale', apporter: "Apporter à l'offre", emission: 'Augmentation de capital', mandat: 'Vous faire élire PDG', strategie: 'Croissance, R&D et marketing', compteCourant: 'Avance en compte courant', rumeur: 'Diffuser une rumeur', decouvert: 'Vendre à découvert', retrait: 'Retrait obligatoire', couvrir: 'Racheter les titres vendus à découvert', plainte: 'Plainte antitrust', rembourserCC: 'Rembourser votre compte courant', obligations: 'Émettre des obligations', rachatObl: 'Rembourser par anticipation', demission: 'Démissionner de la présidence',
  bons: 'Adopter des bons de défense', retirerBons: 'Retirer les bons de défense',
};

export const AVEC_MONTANT = ['acheter', 'vendre', 'emprunter', 'rembourser', 'dividende', 'rachat', 'investir', 'ceder', 'emission', 'obligations', 'compteCourant', 'rembourserCC', 'rumeur', 'decouvert', 'couvrir'];

// Montant disponible ou plafond affiché au-dessus du champ de montant
export function disponible(x) {
  const { s, c, t, m, acteur, prime, numEff, payout, absorbee, modeEm, souscripteur, plaignant, souscrire, investisseur, typeObl, maturite, croissance, effort, offre, action } = x;
  if (t === 'vendre') return (c.actionnaires[acteur] || 0) * c.prix;
  if (t === 'acheter') return Math.min(montantAvantOffre(s, acteur, c.id), acteur === JOUEUR ? s.joueur.cash + Math.max(0, MARGE_MAX * valeurPortefeuille(s) - s.joueur.marge) : s.societes[acteur].cash);
  if (t === 'opa') return acteur === JOUEUR ? s.joueur.cash + Math.max(0, MARGE_MAX * valeurPortefeuille(s) - s.joueur.marge) : s.societes[acteur].cash;
  if (t === 'emprunter') return capaciteEmprunt(c, s);
  if (t === 'decouvert') return Math.min(capaciteDecouvert(s), pretable(s, c) * c.prix);
  if (t === 'couvrir') return (positionsCourtes(s)[c.id]?.titres || 0) * c.prix;
  if (t === 'rumeur' || t === 'compteCourant') return s.joueur.cash + Math.max(0, MARGE_MAX * valeurPortefeuille(s) - s.joueur.marge);
  if (t === 'rembourserCC') return Math.min(c.cash, compteCourant(c));
  if (t === 'emission') return montantMaxEmission(c, modeEm);
  if (t === 'obligations') return capaciteObligataire(s, c, typeObl);
  if (t === 'rembourser') return Math.min(c.cash, c.dette);
  if (t === 'ceder') return c.actifs * 0.6;
  return c.cash;
}

// Lignes de l'aperçu, ou null si l'ordre n'est pas encore calculable
export function calculerApercu(x) {
  const { s, c, t, m, acteur, prime, numEff, payout, absorbee, modeEm, souscripteur, plaignant, souscrire, investisseur, typeObl, maturite, croissance, effort, offre, action, dispo } = x;
  let apercu = null;
  if (t === 'acheter' && m > 0) { const a = apercuAchat(s, c.id, m); apercu = [['Titres obtenus', fT(a.titres)], ['Prix moyen', fE(a.prixMoyen)], ['Coût total', fM(a.cout)], ['Cours après', fE(a.prixApres)], ['Part acquise', fP(a.pctApres, 1)], ['Flottant restant', fP((a.flottant - a.titres) / c.actions, 1)], ...(montantAvantOffre(s, acteur, c.id) < Infinity ? [['Avant l\'offre obligatoire (30 %)', fM(montantAvantOffre(s, acteur, c.id))]] : [])]; }
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
      ...(a.surenchere ? [['Surenchère', <span className="alerte-apercu">{a.surenchere.nom} surenchérirait à {fE(a.surenchere.prixOffre)} et l'emporterait : votre offre deviendrait caduque, {fM(FRAIS_OFFRE_CADUQUE * a.valeur)} de frais perdus. Une prime d'au moins {fP(primeDissuasive(s, acteur, c.id))} le découragerait.</span>]] : []),
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
  if (t === 'dividende' && m > 0) apercu = [['Par action', fE(m / c.actions)], [`Pour vous (direct${fiscaliteActive(s) ? `, après ${fP(IMPOT_DIVIDENDES)} de prélèvement` : ''})`, fM(netDeRevenu(s, JOUEUR, m * pct(c, JOUEUR)))], ['Trésorerie après', fM(c.cash - m)]];
  if (t === 'investir' && m > 0) { const g = m * caParEuro(c.secteur); apercu = [['Actifs après', fM(c.actifs + m)], ['CA supplémentaire', `${fM(g)} d'ici deux ans`], ['EBIT supplémentaire à maturité', fM(g * c.margeRef)], ['Valeur de marché immédiate', `≈ ${fM(ANTICIPATION * g * c.margeRef * multiple(s, c))} pour ${fM(m)} investis`]]; }
  if (t === 'ceder' && m > 0) { const mm = Math.min(m, c.actifs * 0.6); apercu = [['Produit (décote 15 %)', fM(mm * 0.85)], ['CA après', fM(Math.max(c.ca - mm * c.rot, c.ca * 0.3))]]; }
  if (t === 'restructurer') apercu = [['Coût', `${fM(coutRestructuration(c))} (${fP(coutRestructuration(c) / c.ca, 1)} du CA)`], ['Trésorerie disponible', fM(c.cash)], ['Marge cible', `${fP(c.margeRef, 1)} → ${fP(margeApresRestructuration(c), 1)}`], ['EBIT supplémentaire à terme', fM((margeApresRestructuration(c) - c.margeRef) * c.ca)], ['Prochain plan', `dans ${DELAI_RESTRUCTURATION} trimestres`]];
  if (t === 'strategie') {
    const a = apercuStrategie(s, c.id, { croissance, effort });
    const valeur = (p) => p.ca * p.margeCible * multiple(s, c) / facteurCroissance(c) * p.facteurCroissance;   // effets en gestation et crédit de croissance compris
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
  if (t === 'bons' || t === 'retirerBons') { const a = apercuBons(s, c.id); apercu = t === 'bons' ? [['Frais d\'émission', fM(a.frais)], ['Trésorerie disponible', fM(c.cash)], ['Décote du multiple', `${fP(a.decote)} tant que les bons sont en vigueur`], ['Offre hostile en cours', a.offre ? `retirée à la clôture (${fE(a.offre.prixOffre)})` : 'aucune']] : [['Décote supprimée', fP(a.decote)], ['Protection', 'perdue : la société redevient attaquable si votre contrôle est relatif']]; }
  if (t === 'retrait') { const a = apercuRetrait(s, c.id); apercu = [['Détention de votre groupe', fP(a.det, 1)], ['Titres des minoritaires', fT(a.titres)], ['Indemnisation par titre', `${fE(a.prix)} (cours ${fE(c.prix)})`], ['Coût total, frais compris', fM(a.cout)], ['Payé par', acteur === JOUEUR ? 'vous' : s.societes[acteur].nom]]; }
  if (t === 'decouvert' && m > 0) { const a = apercuVenteDecouvert(s, c.id, m); apercu = [['Titres empruntés et vendus', fT(a.titres)], ['Prix moyen', fE(a.prixMoyen)], ['Produit encaissé', fM(a.produit)], ['Cours après', fE(a.prixApres)], ['Prêt des titres', `${fM(a.fraisAnnuels)} par an (${fP(TAUX_PRET_TITRES)} de leur valeur)`], ['Dividendes à reverser', `${fM(a.dividendesAnnuels)} par an au rythme actuel`], ['Exposition courte après', fM(a.expositionApres)]]; }
  if (t === 'couvrir' && m > 0) { const p = positionsCourtes(s)[c.id]; const a = apercuCouverture(s, c.id, m >= dispo - 0.1 ? p.titres : m / c.prix); apercu = [['Titres rachetés', fT(a.titres)], ['Prix moyen', fE(a.prixMoyen)], ['Coût', fM(a.cout)], ['Cours après', fE(a.prixApres)], ['Résultat réalisé', <span className={a.resultat >= 0 ? '' : 'alerte-apercu'}>{a.resultat >= 0 ? 'gain de ' : 'perte de '}{fM(Math.abs(a.resultat))}</span>], ['Reste à racheter', fT(a.reste)]]; }
  if (t === 'rumeur' && m > 0) { const a = apercuRumeur(s, c.id, m); apercu = [['Baisse immédiate', `${fP(a.choc, 1)} : ${fE(c.prix)} → ${fE(a.prixApres)}`], ['Risque d\'être démasqué', <span className={a.risque > 0.3 ? 'alerte-apercu' : ''}>{fP(a.risque)}{a.recentes ? ` (${a.recentes} rumeur${a.recentes > 1 ? 's' : ''} récente${a.recentes > 1 ? 's' : ''})` : ''}</span>], ['Amende si l\'AMF vous démasque', fM(a.amende)]]; }
  if (t === 'plainte' && plaignant) { const a = apercuPlainte(s, plaignant, c.id); apercu = [['Part de marché de ' + c.nom, fP(a.part, 1)], ['Chances de condamnation', <span className={a.chances < 0.2 ? 'alerte-apercu' : ''}>{fP(a.chances)}</span>], ["Frais d'avocats", `${fM(a.frais)}, payés par ${s.societes[plaignant].nom}`], ['Décision', libelleTour(a.echeance)], ['Si condamnation : amende', fM(a.amende)], ['CA perdu par ' + c.nom, fM(a.caPerdu)], ['Dommages-intérêts pour ' + s.societes[plaignant].nom, fM(a.dommages)], ['CA gagné par ' + s.societes[plaignant].nom, fM(a.caGagne)]]; }
  if (t === 'compteCourant' && m > 0) apercu = [['Trésorerie de ' + c.nom + ' après', fM(c.cash + m)], ['Votre créance après', fM(compteCourant(c) + m)], ['Intérêts annuels', `${fM((compteCourant(c) + m) * tauxCompteCourant(s))} à ${fP(tauxCompteCourant(s), 2)}, taux variable`], ['Votre détention', `${fP(pct(c, JOUEUR), 1)}, inchangée`], ...(m > s.joueur.cash + 1e-9 ? [['Financement', <span className="alerte-apercu">{fM(m - s.joueur.cash)} tirés sur votre marge</span>]] : [])];
  if (t === 'rembourserCC' && m > 0) { const mm = Math.min(m, compteCourant(c)); apercu = [['Remboursé', fM(mm)], ['Reste dû', fM(compteCourant(c) - mm)], ['Trésorerie de ' + c.nom + ' après', fM(c.cash - mm)]]; }
  if (t === 'payout') apercu = [['Dividende annuel estimé', fM(Math.max(0, resultatNetAnnuel(s, c)) * payout)], [`Dont pour vous (direct${fiscaliteActive(s) ? `, après ${fP(IMPOT_DIVIDENDES)} de prélèvement` : ''})`, fM(netDeRevenu(s, JOUEUR, Math.max(0, resultatNetAnnuel(s, c)) * payout * pct(c, JOUEUR)))]];
  if (t === 'fusion' && absorbee) { const b = s.societes[absorbee]; const emis = (b.actions - (b.actionnaires[c.id] || 0)) * b.prix / c.prix; const recus = (b.actionnaires[JOUEUR] || 0) * b.prix / c.prix; apercu = [['Parité', `${nf(3).format(b.prix / c.prix)} ${c.nom} par ${b.nom}`], ['Titres émis', `${fT(emis)} (dont ${fT(recus)} pour vous)`], ['Votre part de ' + c.nom, `${fP(pct(c, JOUEUR), 1)} → ${fP(((c.actionnaires[JOUEUR] || 0) + recus) / (c.actions + emis - (c.actionnaires[b.id] || 0)), 1)}`], ['CA consolidé', fM(c.ca + b.ca)], ['Dette consolidée', fM(c.dette + b.dette)], ['Synergies', b.secteur === c.secteur ? 'même secteur : marge +8 %' : 'aucune (secteurs différents)']]; }
  return apercu;
}

// Exécute l'ordre et renvoie le nouvel état ; un refus lève une Error au message lisible
export function executerOrdre(x) {
  const { s, c, t, m, acteur, prime, numEff, payout, absorbee, modeEm, souscripteur, plaignant, souscrire, investisseur, typeObl, maturite, croissance, effort, offre, action, dispo } = x;
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
  else if (t === 'rumeur') n = lancerRumeur(s, c.id, m);
  else if (t === 'decouvert') n = vendreADecouvert(s, c.id, m);
  else if (t === 'retrait') n = retraitObligatoire(s, acteur, c.id);
  else if (t === 'couvrir') { const p = positionsCourtes(s)[c.id]; n = couvrir(s, c.id, m >= dispo - 0.1 ? p.titres : m / c.prix); }
  else if (t === 'plainte') { if (!plaignant) throw new Error(`Il vous faut contrôler une société d'exploitation du même secteur pour porter plainte.`); n = porterPlainte(s, plaignant, c.id); }
  else if (t === 'rembourserCC') n = rembourserCompteCourant(s, c.id, m);
  else if (t === 'mandat') n = prendreMandat(s, c.id);
  else if (t === 'obligations') n = emettreObligations(s, c.id, { montant: m, maturite, type: typeObl });
  else if (t === 'rachatObl') n = rembourserObligation(s, c.id, action.obligId);
  else if (t === 'demission') n = quitterMandat(s, c.id);
  else if (t === 'strategie') n = definirStrategie(s, c.id, { croissance, effort });
  else if (t === 'bons') n = adopterBons(s, c.id);
  else if (t === 'retirerBons') n = retirerBons(s, c.id);
  return n;
}
