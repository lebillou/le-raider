// Mandats de PDG : fixe, bonus, stock-options, révocation.
import { actives, capi, societe } from './acces.js';
import { IMPOT, JOUEUR, clamp, compte, nomDetenteur } from './config.js';
import { controlees, detentionEffective, repartitionControle } from './controle.js';
import { journal } from './creation.js';
import { ebitAnnuel } from './finance.js';
import { filiale } from './pilotage.js';
import { SECT_BY_ID, estHolding } from './secteurs.js';
import { cloner, crediter } from './transactions.js';
import { fmtOptions, fmtTitres } from './trimestre.js';

// ---------- DIRIGEANTS : MANDATS DE PDG ET RÉMUNÉRATION ----------
// Le groupe qui contrôle une société peut s'en faire élire PDG et se faire rémunérer :
// un fixe qui croît avec la taille, un bonus annuel sur objectifs, des stock-options.
export const MANDATS_MAX = 5;                 // cumul des mandats de dirigeant
export const IMPOT_REVENU = 0.45;             // salaire et bonus
export const IMPOT_PLUS_VALUE = 0.30;         // gain de levée d'options
export const BONUS_CIBLE = 1.0;               // bonus cible, en multiple du fixe (plafonné à 150 % de la cible)
export const OPTIONS_ANNUELLES = 1.0;         // valeur des options attribuées chaque année, en multiple du fixe
export const VALEUR_OPTION = 0.25;            // valeur d'une option à la monnaie, en fraction du cours
export const ACQUISITION_OPTIONS = 12;        // trimestres avant de pouvoir lever
export const tailleRemun = (c) => Math.max(c.ca, 0.25 * capi(c));
// 0,1 M€ + 0,03 × √taille, plafonné à 8 % de l'EBIT (0,05 M€ au moins) pour ne pas vider une petite société
export const fixeAnnuel = (c) => Math.max(0.05, Math.min(0.1 + 0.03 * Math.sqrt(Math.max(0, tailleRemun(c))), 0.08 * Math.max(0, ebitAnnuel(c)) + (estHolding(c) ? 0.1 + 0.03 * Math.sqrt(Math.max(0, tailleRemun(c))) : 0)));
export const mandatsDe = (s, h) => actives(s).filter(c => c.ceo && c.ceo.h === h);
// Coût annuel de la direction (fixe + bonus cible) : il sort de la trésorerie, le marché ne le capitalise pas
export const coutDirection = (c) => c.ceo ? fixeAnnuel(c) * (1 + BONUS_CIBLE) : 0;

export function apercuMandat(s, id, h = JOUEUR) {
  const c = societe(s, id);
  const fixe = fixeAnnuel(c);
  const bonus = fixe * BONUS_CIBLE;
  const options = fixe * OPTIONS_ANNUELLES / (VALEUR_OPTION * c.prix);
  const revenuNet = (fixe + bonus) * (1 - IMPOT_REVENU) + fixe * OPTIONS_ANNUELLES * (1 - IMPOT_PLUS_VALUE);
  const ctl = repartitionControle(s);
  const det = detentionEffective(s, id, controlees(s, h, ctl), h);
  const quotePart = det * (fixe * (1 - IMPOT) + bonus) + det * fixe * OPTIONS_ANNUELLES;   // part du coût que vous supportez comme actionnaire (le fixe est déductible)
  return { fixe, bonus, bonusMax: bonus * 1.5, options, strike: c.prix, cout: fixe + bonus + fixe * OPTIONS_ANNUELLES, revenuNet, det, quotePart, gainNet: revenuNet - quotePart, mandats: mandatsDe(s, h).length };
}
export function attribuerOptions(s, c) {
  const n = fixeAnnuel(c) * OPTIONS_ANNUELLES / (VALEUR_OPTION * c.prix);
  c.ceo.options.push({ n, K: c.prix, tour: s.tour });
  return n;
}
export function _prendreMandat(s, c, h) {
  c.ceo = { h, depuis: s.tour, options: [], refEbit: ebitAnnuel(c), refPrix: c.prix, refIndice: s.indice || 100, dernierBonus: null, percu: 0 };
  const n = attribuerOptions(s, c);
  journal(s, h === JOUEUR ? 'filiale' : 'concurrent', `${h === JOUEUR ? 'Vous êtes élu' : nomDetenteur(s, h) + ' est élu'} PDG de ${c.nom} : fixe ${fixeAnnuel(c).toFixed(2)} M€ par an, bonus cible équivalent, ${fmtOptions(n)} au prix d'exercice de ${c.prix.toFixed(2)} €.`, h);
}
export function prendreMandat(s0, id) {
  const s = cloner(s0);
  const c = societe(s, id);
  if (repartitionControle(s)[id] !== JOUEUR) throw new Error(`Vous devez contrôler ${c.nom} pour vous en faire élire PDG.`);
  if (c.ceo && c.ceo.h === JOUEUR) throw new Error(`Vous présidez déjà ${c.nom}.`);
  if (mandatsDe(s, JOUEUR).length >= MANDATS_MAX) throw new Error(`Vous cumulez déjà ${MANDATS_MAX} mandats de dirigeant : démissionnez d'une présidence d'abord.`);
  _prendreMandat(s, c, JOUEUR);
  return s;
}
export function _finMandat(s, c, raison) {
  const ce = c.ceo;
  if (!ce) return;
  const perdues = ce.options.reduce((a, o) => a + o.n, 0);
  delete c.ceo;
  journal(s, ce.h === JOUEUR ? 'alerte' : 'concurrent', `${ce.h === JOUEUR ? 'Votre mandat' : 'Le mandat de ' + nomDetenteur(s, ce.h)} de PDG de ${c.nom} prend fin (${raison})${perdues > 1e-6 ? ` ; ${fmtOptions(perdues)} non acquises sont annulées` : ''}.`, ce.h);
}
export function quitterMandat(s0, id) {
  const s = cloner(s0);
  const c = societe(s, id);
  if (!c.ceo || c.ceo.h !== JOUEUR) throw new Error(`Vous ne présidez pas ${c.nom}.`);
  _finMandat(s, c, 'démission');
  return s;
}
// Revue trimestrielle des mandats, après la cotation : levée des options, bonus annuel
export function gererMandats(s, ctl) {
  for (const c of actives(s)) {
    const ce = c.ceo;
    if (!ce) continue;
    if (ctl[c.id] !== ce.h) { _finMandat(s, c, 'révocation : le contrôle a changé de mains'); continue; }
    // Levée des options acquises, en règlement net : la société remet des actions nouvelles pour le gain, impôt prélevé en titres
    const restantes = [];
    for (const o of ce.options) {
      if (s.tour - o.tour < ACQUISITION_OPTIONS) { restantes.push(o); continue; }
      if (c.prix > o.K * 1.0001) {
        const brut = o.n * (c.prix - o.K) / c.prix;
        const net = brut * (1 - IMPOT_PLUS_VALUE);
        const avant = c.actions;
        c.actions += net;
        c.actionnaires[ce.h] = (c.actionnaires[ce.h] || 0) + net;
        c.prix *= avant / c.actions;                    // dilution immédiate des autres actionnaires
        ce.percu += net * c.prix;
        compte(s, ce.h).remTotale = (compte(s, ce.h).remTotale || 0) + net * c.prix;
        journal(s, ce.h === JOUEUR ? 'filiale' : 'concurrent', `${ce.h === JOUEUR ? 'Vous levez' : nomDetenteur(s, ce.h) + ' lève'} ${fmtOptions(o.n)} ${c.nom} (prix d'exercice ${o.K.toFixed(2)} €, cours ${c.prix.toFixed(2)} €) : ${fmtTitres(net)} remis en actions après impôt, ${(net * c.prix).toFixed(2)} M€.`, ce.h);
      } else {
        journal(s, ce.h === JOUEUR ? 'filiale' : 'concurrent', `${fmtOptions(o.n)} ${c.nom} expirent sans valeur (prix d'exercice ${o.K.toFixed(2)} €, cours ${c.prix.toFixed(2)} €).`, ce.h);
      }
    }
    ce.options = restantes;
    // Revue annuelle : bonus sur la croissance de l'EBIT et la performance boursière relative, nouvelle attribution d'options
    if (s.tour > ce.depuis && (s.tour - ce.depuis) % 4 === 0) {
      const ebit = ebitAnnuel(c);
      const croissance = ce.refEbit > 0.01 ? ebit / ce.refEbit - 1 : (ebit > 0.01 ? 0.1 : -0.1);
      const ecart = (c.prix / ce.refPrix - 1) - ((s.indice || 100) / (ce.refIndice || 100) - 1);
      const scoreEbit = clamp(croissance / 0.10 * 1.5, 0, 1.5);   // 0 % → 0 ; +6,7 % → 100 % ; +10 % → 150 %
      const scoreBourse = clamp(1 + 5 * ecart, 0, 1.5);           // au niveau du marché → 100 % ; −20 pts → 0 ; +10 pts → 150 %
      const taux = 0.5 * scoreEbit + 0.5 * scoreBourse;
      const bonus = Math.min(fixeAnnuel(c) * BONUS_CIBLE * taux, Math.max(0, c.cash));
      if (bonus > 1e-6) {
        c.cash -= bonus;
        const net = bonus * (1 - IMPOT_REVENU);
        crediter(s, ce.h, net);
        ce.percu += net;
        compte(s, ce.h).remTotale = (compte(s, ce.h).remTotale || 0) + net;
      }
      ce.dernierBonus = { taux, montant: bonus, croissance, ecart, tour: s.tour };
      const n = attribuerOptions(s, c);
      journal(s, ce.h === JOUEUR ? 'filiale' : 'concurrent', `Revue annuelle de ${ce.h === JOUEUR ? 'votre mandat' : 'la direction'} chez ${c.nom} : EBIT ${croissance >= 0 ? '+' : ''}${(100 * croissance).toFixed(1)} %, bourse ${ecart >= 0 ? '+' : ''}${(100 * ecart).toFixed(1)} pts contre le marché ; bonus ${Math.round(100 * taux)} % de la cible, ${bonus.toFixed(2)} M€ ; ${fmtOptions(n)} nouvelles à ${c.prix.toFixed(2)} €.`, ce.h);
      ce.refEbit = ebit; ce.refPrix = c.prix; ce.refIndice = s.indice || 100;
    }
  }
}

export const COUT_RESTRUCTURATION = 0.04;   // en fraction du CA
export const DELAI_RESTRUCTURATION = 8;     // trimestres entre deux plans
export function restructurer(s0, id) {
  const s = cloner(s0); const c = filiale(s, id);
  if (estHolding(c)) throw new Error(`${c.nom} est une holding : rien à restructurer.`);
  const cout = COUT_RESTRUCTURATION * c.ca;
  if (cout > c.cash + 1e-9) throw new Error(`Un plan de restructuration coûte ${cout.toFixed(1)} M€ ; ${c.nom} n'a que ${c.cash.toFixed(1)} M€.`);
  if (c.derniereRestructuration !== undefined && s.tour - c.derniereRestructuration < DELAI_RESTRUCTURATION) throw new Error(`${c.nom} sort à peine d'un plan : il faut attendre ${DELAI_RESTRUCTURATION - (s.tour - c.derniereRestructuration)} trimestres.`);
  const plafond = SECT_BY_ID[c.secteur].marge * 1.6;
  if (c.margeRef >= plafond - 1e-9) throw new Error(`${c.nom} est déjà au plafond de rentabilité de son secteur.`);
  _restructurer(s, c, 'filiale');
  return s;
}
export function peutRestructurer(s, c) {
  return !estHolding(c) && COUT_RESTRUCTURATION * c.ca <= c.cash && (c.derniereRestructuration === undefined || s.tour - c.derniereRestructuration >= DELAI_RESTRUCTURATION) && c.margeRef < SECT_BY_ID[c.secteur].marge * 1.6 - 1e-9;
}
export function _restructurer(s, c, type, acteur = JOUEUR) {
  const cout = COUT_RESTRUCTURATION * c.ca;
  c.cash -= cout;
  c.margeRef = Math.min(c.margeRef * 1.15, SECT_BY_ID[c.secteur].marge * 1.6);
  c.derniereRestructuration = s.tour;
  journal(s, type, `${c.nom} lance un plan de restructuration (${cout.toFixed(1)} M€) : marge cible portée à ${(100 * c.margeRef).toFixed(1)} %.`, acteur);
}
export function fixerDividende(s0, id, payout) {
  if (!(payout >= 0) || payout > 0.8) throw new Error('Taux de distribution entre 0 et 80 %');
  const s = cloner(s0); const c = filiale(s, id);
  c.payout = payout;
  journal(s, 'filiale', `${c.nom} fixe son taux de distribution à ${Math.round(100 * payout)} % du résultat.`, JOUEUR);
  return s;
}
export function fusionner(s0, absorbantId, absorbeeId) {
  const s = cloner(s0);
  const a = filiale(s, absorbantId);
  const b = societe(s, absorbeeId);
  if (a === b) throw new Error('Une société ne peut s\'absorber elle-même.');
  const ctrl = controlees(s);
  if (!ctrl.has(b.id)) throw new Error(`Vous devez contrôler ${b.nom} (directement ou via vos sociétés) pour la faire absorber par ${a.nom}.`);
  const ratio = b.prix / a.prix;
  // Les autres actionnaires de B reçoivent des titres A
  for (const [h, t] of Object.entries(b.actionnaires)) {
    if (h === a.id) continue;
    const nouveaux = t * ratio;
    a.actions += nouveaux;
    a.actionnaires[h] = (a.actionnaires[h] || 0) + nouveaux;
  }
  // Les participations de B passent à A ; les titres A détenus par B sont annulés
  for (const c of actives(s)) {
    if (c === b) continue;
    const t = c.actionnaires[b.id];
    if (!t) continue;
    delete c.actionnaires[b.id];
    if (c === a) a.actions -= t;                                   // titres A détenus par B : annulés
    else c.actionnaires[a.id] = (c.actionnaires[a.id] || 0) + t;  // participations de B transférées à A
  }
  // Consolidation des comptes
  // Une holding qui absorbe une société d'exploitation en prend le métier
  const devientOperationnelle = estHolding(a) && !estHolding(b);
  if (devientOperationnelle) a.secteur = b.secteur;
  const caTot = a.ca + b.ca;
  const poids = (x) => x.ca + (x.caPipeline || 0);
  const pTot = poids(a) + poids(b);
  if (pTot > 0) {
    a.marge = caTot > 0 ? (a.ca * a.marge + b.ca * b.marge) / caTot : (devientOperationnelle ? b.marge : a.marge);
    a.margeRef = (poids(a) * a.margeRef + poids(b) * b.margeRef) / pTot;
    // Les effets de R&D ou de marketing encore en gestation se consolident comme la marge cible ;
    // la stratégie de l'absorbante s'applique à l'ensemble
    const latente = (poids(a) * (a.margeLatente || 0) + poids(b) * (b.margeLatente || 0)) / pTot;
    if (latente) a.margeLatente = latente; else delete a.margeLatente;
  }
  a.caPipeline = (a.caPipeline || 0) + (b.caPipeline || 0);
  a.divRecus = 0;
  a.ca = caTot; a.actifs += b.actifs; a.dette += b.dette; a.cash += b.cash;
  a.obligations = [...(a.obligations || []), ...(b.obligations || [])];
  // Les comptes courants de l'absorbée deviennent des créances sur l'absorbante
  for (const [h, m] of Object.entries(b.comptesCourants || {})) a.comptesCourants = { ...(a.comptesCourants || {}), [h]: (a.comptesCourants?.[h] || 0) + m };
  a.rot = a.actifs > 0 ? (a.ca + a.caPipeline) / a.actifs : 0;
  const synergie = a.secteur === b.secteur && !estHolding(a) && !devientOperationnelle;
  if (synergie) a.margeRef = Math.min(a.margeRef * 1.08, SECT_BY_ID[a.secteur].marge * 1.6);
  if (b.ceo) _finMandat(s, b, `absorption par ${a.nom}`);
  b.active = false; b.absorbeePar = a.id;
  s.stats.fusions++;
  journal(s, 'fusion', `${a.nom} absorbe ${b.nom} : parité ${ratio.toFixed(3)} titre ${a.nom} par titre ${b.nom}${synergie ? ' ; synergies attendues sur la marge' : ''}.`, JOUEUR);
  return s;
}
