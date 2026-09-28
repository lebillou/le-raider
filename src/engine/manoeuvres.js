// Manœuvres hostiles : plaintes antitrust contre un concurrent, rumeurs pour faire baisser un cours.
import { actives, capi, fortune, societe } from './acces.js';
import { JOUEUR, clamp } from './config.js';
import { controlees } from './controle.js';
import { journal } from './creation.js';
import { SECT_BY_ID, estHolding } from './secteurs.js';
import { cloner, debiter } from './transactions.js';
import { libelleTour } from './trimestre.js';

// ---------- PLAINTES ANTITRUST ----------
// Une société d'exploitation que vous contrôlez saisit l'Autorité de la concurrence contre une concurrente
// du même secteur. Frais d'avocats payés tout de suite, décision un an plus tard. Les chances dépendent
// de la part de marché de la cible : un acteur dominant est vulnérable, un petit ne l'est guère.
// Condamnation : amende, injonction qui lui coûte des parts de marché (dont un tiers revient au
// plaignant), dommages-intérêts au plaignant. Relaxe : les frais sont perdus. Après une décision, la
// cible ne peut plus être poursuivie pendant deux ans.
export const DELAI_PLAINTE = 4;               // trimestres avant la décision
export const AMENDE_ANTITRUST = 0.04;         // en fraction du CA de la cible
export const DOMMAGES_ANTITRUST = 0.01;       // versés au plaignant, en fraction du CA de la cible
export const INJONCTION = 0.04;               // CA perdu par la cible ; un tiers revient au plaignant
export const PART_PLAIGNANT = 1 / 3;
export const REPIT_ANTITRUST = 8;             // trimestres après une décision avant de pouvoir reposer une plainte
export const fraisPlainte = (cible) => Math.min(8, 0.5 + 0.003 * cible.ca);
export function partDeMarche(s, c) {
  let total = 0;
  for (const d of actives(s)) if (d.secteur === c.secteur) total += d.ca;
  return total > 0 ? c.ca / total : 0;
}
export const chancesPlainte = (part) => clamp(0.05 + 1.6 * (part - 0.1), 0.05, 0.8);
export const procesEnCours = (s, cibleId) => (s.proces || []).filter(p => p.cible === cibleId);

export function apercuPlainte(s, plaignantId, cibleId) {
  const P = societe(s, plaignantId), c = societe(s, cibleId);
  if (estHolding(P)) throw new Error(`${P.nom} est une holding : seule une société concurrente, du même secteur, peut porter plainte.`);
  if (estHolding(c)) throw new Error(`${c.nom} est une holding : elle n'a pas de marché à dominer.`);
  if (P.secteur !== c.secteur) throw new Error(`${P.nom} n'est pas concurrente de ${c.nom} : la plainte doit venir d'une société du secteur ${SECT_BY_ID[c.secteur].nom}.`);
  if (P.id === c.id) throw new Error('Une société ne se poursuit pas elle-même.');
  const part = partDeMarche(s, c);
  return {
    frais: fraisPlainte(c), part, chances: chancesPlainte(part), echeance: s.tour + DELAI_PLAINTE,
    amende: AMENDE_ANTITRUST * c.ca, dommages: DOMMAGES_ANTITRUST * c.ca, caPerdu: INJONCTION * c.ca, caGagne: INJONCTION * PART_PLAIGNANT * c.ca,
  };
}
export function porterPlainte(s0, plaignantId, cibleId) {
  const s = cloner(s0);
  const ctrl = controlees(s);
  const P = societe(s, plaignantId), c = societe(s, cibleId);
  if (!ctrl.has(P.id)) throw new Error(`Vous ne contrôlez pas ${P.nom}.`);
  if (ctrl.has(c.id)) throw new Error(`${c.nom} fait partie de votre groupe : on ne poursuit pas sa propre société.`);
  if (procesEnCours(s, c.id).length) throw new Error(`Une procédure contre ${c.nom} est déjà en cours.`);
  if (c.decisionAntitrust !== undefined && s.tour - c.decisionAntitrust < REPIT_ANTITRUST) throw new Error(`L'Autorité de la concurrence a statué sur ${c.nom} il y a peu : nouvelle plainte possible dans ${REPIT_ANTITRUST - (s.tour - c.decisionAntitrust)} trimestre(s).`);
  const ap = apercuPlainte(s, plaignantId, cibleId);
  debiter(s, P.id, ap.frais);
  s.proces = [...(s.proces || []), { plaignant: P.id, cible: c.id, tour: s.tour, echeance: ap.echeance, chances: ap.chances, frais: ap.frais }];
  c.sentiment = clamp((c.sentiment || 0) - 0.05, -0.5, 0.5);   // l'incertitude pèse sur le titre
  journal(s, 'filiale', `${P.nom} saisit l'Autorité de la concurrence contre ${c.nom} pour abus de position dominante (${Math.round(100 * ap.part)} % du marché) ; décision attendue en ${libelleTour(ap.echeance)}.`, JOUEUR);
  return s;
}

// ---------- RUMEURS ----------
// Vous payez des relais pour faire circuler de fausses nouvelles sur une société : le cours chute aussitôt,
// d'autant plus que la société est petite, puis revient vers sa valeur à mesure que le marché s'aperçoit
// qu'il ne se passe rien. À la clôture, l'AMF peut démasquer la manœuvre : amende lourde et démenti qui
// fait remonter le titre. Le risque croît avec l'ampleur de la baisse et avec le nombre de rumeurs récentes.
export const BUDGET_RUMEUR_MIN = 0.2;
export const CHOC_RUMEUR_MAX = 0.2;
export const MEMOIRE_AMF = 8;                 // trimestres pendant lesquels l'AMF se souvient de vos rumeurs
export const chocRumeur = (budget, capitalisation) => Math.min(CHOC_RUMEUR_MAX, 0.7 * Math.sqrt(budget / capitalisation));
export const rumeursRecentes = (s) => (s.rumeurs || []).filter(x => s.tour - x.tour < MEMOIRE_AMF).length;
export const risqueRumeur = (s, choc) => Math.min(0.75, 0.12 + 0.08 * rumeursRecentes(s) + 0.8 * choc);
export const amendeAMF = (s, budget) => Math.max(1, 5 * budget + 0.03 * Math.max(0, fortune(s)));

export function apercuRumeur(s, cibleId, budget) {
  const c = societe(s, cibleId);
  if (!(budget >= BUDGET_RUMEUR_MIN)) throw new Error(`Budget minimum : ${BUDGET_RUMEUR_MIN} M€.`);
  const choc = chocRumeur(budget, capi(c));
  return { choc, prixApres: c.prix * (1 - choc), risque: risqueRumeur(s, choc), amende: amendeAMF(s, budget), recentes: rumeursRecentes(s) };
}
export function lancerRumeur(s0, cibleId, budget) {
  const s = cloner(s0);
  const c = societe(s, cibleId);
  if (controlees(s).has(c.id)) throw new Error(`${c.nom} fait partie de votre groupe : la dénigrer ne ferait que vous appauvrir.`);
  const ap = apercuRumeur(s, cibleId, budget);
  debiter(s, JOUEUR, budget);
  c.prix *= 1 - ap.choc;
  const persistance = 0.5 * Math.log(1 - ap.choc);   // une partie de la défiance s'installe dans le sentiment
  c.sentiment = clamp((c.sentiment || 0) + persistance, -0.5, 0.5);
  s.rumeurs = [...(s.rumeurs || []), { cible: c.id, tour: s.tour, budget, choc: ap.choc, risque: ap.risque, persistance }];
  journal(s, 'alerte', `Vous faites circuler des rumeurs alarmantes sur ${c.nom} (${budget.toFixed(1)} M€) : le titre perd ${Math.round(100 * ap.choc)} %.`, JOUEUR);
  return s;
}

// ---------- RÉSOLUTION À LA CLÔTURE ----------
// Appelée par finTrimestre après les événements : ne tire l'aléa que s'il y a des manœuvres en cours,
// si bien qu'une partie sans manœuvre reste identique au jeu de référence.
export function traiterManoeuvres(s, r) {
  // Rumeurs du trimestre écoulé : l'AMF enquête
  for (const x of s.rumeurs || []) {
    if (x.examinee) continue;
    x.examinee = true;
    if (r() >= x.risque) continue;
    x.demasquee = true;
    const amende = amendeAMF(s, x.budget);
    const j = s.joueur;
    j.cash -= amende;
    if (j.cash < 0) { j.marge += -j.cash; j.cash = 0; }
    const c = s.societes[x.cible];
    if (c?.active) c.sentiment = clamp((c.sentiment || 0) - x.persistance, -0.5, 0.5);   // le démenti efface la défiance
    journal(s, 'alerte', `L'AMF démasque votre campagne de rumeurs contre ${c ? c.nom : 'une société'} : amende de ${amende.toFixed(1)} M€ ; le titre se redresse.`, JOUEUR);
  }
  s.rumeurs = (s.rumeurs || []).filter(x => s.tour - x.tour < MEMOIRE_AMF);
  if (!s.rumeurs.length) delete s.rumeurs;
  // Plaintes arrivées à échéance
  const restants = [];
  for (const p of s.proces || []) {
    const P = s.societes[p.plaignant], c = s.societes[p.cible];
    if (!c?.active || !P?.active) {
      if (c) journal(s, 'evenement', `La procédure antitrust contre ${c.nom} s'éteint : ${!c.active ? 'la société a disparu' : 'le plaignant a disparu'}.`);
      continue;
    }
    if (s.tour < p.echeance) { restants.push(p); continue; }
    c.decisionAntitrust = s.tour;
    if (r() < p.chances) {
      const amende = AMENDE_ANTITRUST * c.ca, dommages = DOMMAGES_ANTITRUST * c.ca, perdu = INJONCTION * c.ca;
      c.cash -= amende + dommages;           // une trésorerie négative est refinancée à la clôture, comme toute détresse
      c.ca -= perdu;
      P.cash += dommages;
      P.ca += perdu * PART_PLAIGNANT;
      c.sentiment = clamp((c.sentiment || 0) - 0.05, -0.5, 0.5);
      journal(s, 'evenement', `L'Autorité de la concurrence condamne ${c.nom} pour abus de position dominante, sur plainte de ${P.nom} : amende de ${amende.toFixed(1)} M€, ${dommages.toFixed(1)} M€ de dommages-intérêts, ${perdu.toFixed(1)} M€ de chiffre d'affaires perdus.`);
    } else {
      c.sentiment = clamp((c.sentiment || 0) + 0.05, -0.5, 0.5);
      journal(s, 'evenement', `L'Autorité de la concurrence déboute ${P.nom} de sa plainte contre ${c.nom} ; ${p.frais.toFixed(1)} M€ de frais perdus.`);
    }
  }
  if (restants.length) s.proces = restants; else delete s.proces;
}
