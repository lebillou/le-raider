// Obligations classiques, haut rendement, convertibles ; échéances et défauts.
import { actives, societe, valeurParticipations } from './acces.js';
import { JOUEUR } from './config.js';
import { journal } from './creation.js';
import { SPREADS, capaciteEmprunt, detteTotale, ebitAnnuel, levier, ltv, notation, tauxEmprunt } from './finance.js';
import { filiale } from './pilotage.js';
import { estHolding } from './secteurs.js';
import { cloner } from './transactions.js';
import { fmtTitres, libelleTour } from './trimestre.js';

// ---------- OBLIGATIONS ----------
// Trois familles, toutes à taux fixe et remboursables in fine, sans covenant :
//  - classique : réservée aux signatures solides, dette totale jusqu'à 4× l'EBIT ;
//  - haut rendement : jusqu'à 6× l'EBIT, coupon majoré, pour financer au-delà de ce que prête la banque ;
//  - convertible : coupon réduit, convertie en actions à l'échéance si le cours dépasse le prix de conversion.
// À l'échéance : remboursement sur la trésorerie, puis refinancement bancaire ; à défaut, les
// porteurs convertissent le reliquat en capital avec une forte décote (restructuration de dette).
export const TYPES_OBLIGATIONS = {
  classique: { nom: 'Obligation classique', levier: 4, ltv: 0.5, surcoupon: 0, prime: 0 },
  hy: { nom: 'Haut rendement', levier: 6, ltv: 0.65, surcoupon: 0.01, prime: 0 },
  convertible: { nom: 'Convertible', levier: 5, ltv: 0.55, surcoupon: 0, prime: 0.30 },
};
export const MATURITES = [5, 7, 10];
export const FRAIS_OBLIGATAIRES = 0.015;
export const PENALITE_ANTICIPE = { classique: 0.01, hy: 0.03, convertible: 0.01 };
export const DECOTE_DEFAUT = 0.5;            // conversion forcée de la créance à la moitié du cours
// Montant maximal émis pour un type donné, compte tenu de la dette déjà en place
export function capaciteObligataire(s, c, type) {
  const t = TYPES_OBLIGATIONS[type];
  const d = detteTotale(c);
  if (estHolding(c)) {
    const base = valeurParticipations(s, c.id) + Math.max(0, c.cash);
    return Math.max(0, (t.ltv * base - d) / (1 - t.ltv));
  }
  const e = ebitAnnuel(c);
  if (type === 'classique' && levier(c) >= 4) return 0;
  return Math.max(0, Math.min(t.levier * e, (type === 'hy' ? 0.9 : 0.75) * (c.actifs + c.cash)) - d);
}
export function apercuObligations(s, id, { montant, maturite, type }) {
  const c = societe(s, id);
  const t = TYPES_OBLIGATIONS[type];
  if (!t) throw new Error('Type d\'obligation inconnu.');
  if (!MATURITES.includes(maturite)) throw new Error('Maturité : 5, 7 ou 10 ans.');
  const cap = capaciteObligataire(s, c, type);
  // Notation et coupon après émission
  const apres = { ...c, cash: c.cash + montant, obligations: [...(c.obligations || []), { nominal: montant, coupon: 0 }] };
  const note = notation(apres, s);
  const tauxLong = s.taux + 0.001 * maturite;                              // prime de terme
  const spread = SPREADS[note];
  // Le marché obligataire, plus large que le pool bancaire, prend 80 % de l'écart de crédit bancaire
  const coupon = type === 'convertible' ? tauxLong + 0.3 * spread : tauxLong + 0.8 * spread + t.surcoupon;
  const prixConversion = type === 'convertible' ? c.prix * (1 + t.prime) : null;
  const titresPotentiels = prixConversion ? montant / prixConversion : 0;
  return {
    type, nom: t.nom, montant, maturite, capacite: cap, depasse: montant > cap + 1e-9,
    note, coupon, tauxBanque: s.taux + spread, frais: montant * FRAIS_OBLIGATAIRES, net: montant * (1 - FRAIS_OBLIGATAIRES),
    chargeAnnuelle: montant * coupon, echeance: s.tour + 4 * maturite, prixConversion, titresPotentiels,
    dilutionPotentielle: titresPotentiels / (c.actions + titresPotentiels),
    levierApres: levier(apres), ltvApres: estHolding(c) ? ltv(s, apres) : null,
  };
}
export function emettreObligations(s0, id, params) {
  const s = cloner(s0); const c = filiale(s, id);
  if (!(params.montant >= 1)) throw new Error('Montant minimum : 1 M€.');
  if (c.derniereObligation === s.tour) throw new Error(`${c.nom} a déjà placé une émission obligataire ce trimestre.`);
  const ap = apercuObligations(s, id, params);
  if (ap.depasse) throw new Error(`Les investisseurs ne souscriront pas plus de ${ap.capacite.toFixed(1)} M€ ${params.type === 'classique' ? 'd\'obligations classiques' : params.type === 'hy' ? 'de haut rendement' : 'de convertibles'} pour ${c.nom}${params.type === 'classique' && levier(c) >= 4 ? ' : son levier dépasse déjà 4× l\'EBIT, il faut passer au haut rendement' : ''}.`);
  s.nbObligations = (s.nbObligations || 0) + 1;
  c.obligations = [...(c.obligations || []), { id: 'O' + s.nbObligations, type: params.type, nominal: params.montant, coupon: ap.coupon, emise: s.tour, echeance: ap.echeance, prixConversion: ap.prixConversion }];
  c.cash += ap.net;
  c.derniereObligation = s.tour;
  journal(s, 'filiale', `${c.nom} émet ${params.montant.toFixed(1)} M€ ${params.type === 'classique' ? 'd\'obligations' : params.type === 'hy' ? 'd\'obligations à haut rendement' : 'd\'obligations convertibles'} à ${params.maturite} ans, coupon ${(100 * ap.coupon).toFixed(2)} %${ap.prixConversion ? `, convertibles à ${ap.prixConversion.toFixed(2)} €` : ''} ; échéance ${libelleTour(ap.echeance)}.`, JOUEUR);
  return s;
}
export function rembourserObligation(s0, id, obligId) {
  const s = cloner(s0); const c = filiale(s, id);
  const o = (c.obligations || []).find(x => x.id === obligId);
  if (!o) throw new Error('Obligation introuvable.');
  const cout = o.nominal * (1 + PENALITE_ANTICIPE[o.type]);
  if (cout > c.cash + 1e-9) throw new Error(`Rembourser coûte ${cout.toFixed(1)} M€ (nominal + ${Math.round(100 * PENALITE_ANTICIPE[o.type])} % de pénalité) ; ${c.nom} n'a que ${c.cash.toFixed(1)} M€.`);
  c.cash -= cout;
  c.obligations = c.obligations.filter(x => x !== o);
  journal(s, 'filiale', `${c.nom} rembourse par anticipation ${o.nominal.toFixed(1)} M€ d'obligations (coupon ${(100 * o.coupon).toFixed(2)} %) pour ${cout.toFixed(1)} M€.`, JOUEUR);
  return s;
}
// Échéances du trimestre : conversion, remboursement, refinancement bancaire ou restructuration
export function traiterEcheances(s, ctl) {
  for (const c of actives(s)) {
    if (!c.obligations || !c.obligations.length) continue;
    const proprio = ctl[c.id] === JOUEUR ? JOUEUR : (ctl[c.id] && s.raiders[ctl[c.id]] ? ctl[c.id] : 'marche');
    const restantes = [];
    for (const o of c.obligations) {
      // Préavis un an avant : trésorerie et crédit bancaire suffiront-ils ?
      if (o.echeance - s.tour === 4 && proprio === JOUEUR) {
        const dispo = Math.max(0, c.cash) + capaciteEmprunt(c, s);
        if (dispo < o.nominal) journal(s, 'alerte', `Mur de refinancement chez ${c.nom} : ${o.nominal.toFixed(1)} M€ d'obligations arrivent à échéance dans un an, trésorerie et crédit bancaire ne couvrent que ${dispo.toFixed(1)} M€.`, JOUEUR);
      }
      if (o.echeance > s.tour) { restantes.push(o); continue; }
      // Convertible dans la monnaie : les porteurs convertissent
      if (o.type === 'convertible' && c.prix > o.prixConversion) {
        const n = o.nominal / o.prixConversion;
        const avant = c.actions;
        c.actions += n; c.actionnaires.public = (c.actionnaires.public || 0) + n;
        c.prix *= (avant * c.prix + o.nominal) / (c.actions * c.prix);   // la dette disparaît, le capital s'élargit
        journal(s, proprio === JOUEUR ? 'filiale' : 'marche', `Les convertibles ${c.nom} (${o.nominal.toFixed(1)} M€) sont converties en ${fmtTitres(n)} nouveaux à ${o.prixConversion.toFixed(2)} € : la dette disparaît, le capital est dilué de ${Math.round(100 * n / c.actions)} %.`, proprio);
        continue;
      }
      // Remboursement : trésorerie d'abord, puis tirage bancaire
      let reste = o.nominal;
      const surCash = Math.min(reste, Math.max(0, c.cash - 0.02 * c.ca));
      c.cash -= surCash; reste -= surCash;
      const cap = capaciteEmprunt({ ...c, obligations: c.obligations.filter(x => x !== o) }, s);
      const banque = Math.min(reste, cap);
      c.dette += banque; reste -= banque;
      if (reste > 0 && reste <= 0.05) { c.cash -= reste; reste = 0; }   // reliquat négligeable : payé sur la trésorerie
      if (reste <= 1e-6) {
        journal(s, proprio === JOUEUR ? 'filiale' : 'marche', `${c.nom} rembourse ${o.nominal.toFixed(1)} M€ d'obligations à l'échéance${banque > 0.01 ? `, dont ${banque.toFixed(1)} M€ refinancés par la banque à ${(100 * tauxEmprunt(s, c)).toFixed(2)} %` : ''}.`, proprio);
        continue;
      }
      // Défaut : restructuration, les porteurs reçoivent du capital à la moitié du cours
      const prixConv = Math.max(0.01, c.prix * DECOTE_DEFAUT);
      const n = reste / prixConv;
      const avant = c.actions;
      c.actions += n; c.actionnaires.public = (c.actionnaires.public || 0) + n;
      c.prix = Math.max(0.01, (avant * c.prix + reste) / c.actions * 0.9);   // le défaut entame aussi la confiance
      journal(s, proprio === JOUEUR ? 'alerte' : 'marche', `Défaut de ${c.nom} sur ${reste.toFixed(1)} M€ d'obligations : les porteurs convertissent leur créance en ${fmtTitres(n)} nouveaux (${Math.round(100 * n / c.actions)} % du capital après).`, proprio);
    }
    c.obligations = restantes;
  }
}
