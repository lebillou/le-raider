// Création de sociétés d'exploitation et de holdings ; journal.
import { actives, valeurParticipations } from './acces.js';
import { JOUEUR, MARGE_MAX, nomDetenteur } from './config.js';
import { controlees } from './controle.js';
import { SECTEURS, SECT_BY_ID, estHolding } from './secteurs.js';
import { cloner, debiter, verifierActeur } from './transactions.js';
import { fmtTitres } from './trimestre.js';
import { multiple, prixCible, valeurEntreprise } from './valorisation.js';

// ---------- CRÉATION DE SOCIÉTÉS ----------
export const CAPITAL_MIN = { operationnelle: 5, holding: 2 };
export const FRAIS_CREATION = { operationnelle: 0.02, holding: 0.005 };
export const MONTEE_EN_CHARGE = 0.125;       // part du CA en construction qui entre en exploitation chaque trimestre (≈ 2 ans)
// Chiffre d'affaires obtenu à maturité par euro investi : calibré pour qu'un euro investi
// vaille ~1,15 € une fois l'activité en régime, quel que soit le secteur.
export const RENDEMENT_INVEST = 1.15;
export const caParEuro = (secId) => RENDEMENT_INVEST / (SECT_BY_ID[secId].marge * SECT_BY_ID[secId].mult);

export const FRAIS_APPORT_NATURE = 0.005;    // commissaire aux apports et actes, sur la valeur apportée en nature
export const BRANCHE_MAX = 0.5;              // part maximale de son activité qu'une société peut apporter

// Constitution d'une société : numéraire, titres cotés apportés au cours, branche d'activité d'une société
// d'exploitation apportée à sa valeur de marché. Calcule tout sans rien modifier ; creerSociete applique ce résultat.
export function apercuCreation(s, { type, secteur, capital = 0, fondateur = JOUEUR, titres = {}, branche = 0 }) {
  if (type !== 'operationnelle' && type !== 'holding') throw new Error('Type de société inconnu.');
  const numeraire = capital;
  if (!(numeraire >= 0)) throw new Error('Apport en numéraire invalide.');
  // Titres cotés détenus par le fondateur, apportés au cours sans passer par le marché
  const apports = [];
  let valeurTitres = 0;
  for (const [id, q] of Object.entries(titres || {})) {
    if (!(q > 0)) continue;
    const d = s.societes[id];
    if (!d || !d.active) throw new Error('Société inconnue ou disparue');
    const detenus = d.actionnaires[fondateur] || 0;
    if (q > detenus * (1 + 1e-9) + 1e-12) throw new Error(`${fondateur === JOUEUR ? 'Vous ne détenez' : `${nomDetenteur(s, fondateur)} ne détient`} que ${fmtTitres(detenus)} ${d.nom}.`);
    const n = Math.min(q, detenus);
    apports.push({ id, titres: n, valeur: n * d.prix });
    valeurTitres += n * d.prix;
  }
  // Branche d'activité : une part du chiffre d'affaires, du CA en construction et des actifs de la fondatrice
  let A = null;
  if (branche) {
    if (!(branche > 0 && branche <= BRANCHE_MAX + 1e-9)) throw new Error(`Une société apporte au plus ${Math.round(100 * BRANCHE_MAX)} % de son activité.`);
    if (type !== 'operationnelle') throw new Error('Une holding ne reçoit pas d\'actifs industriels : créez une société d\'exploitation.');
    A = fondateur !== JOUEUR ? s.societes[fondateur] : null;
    if (!A || !A.active || estHolding(A)) throw new Error('Seule une société d\'exploitation apporte une branche de son activité : choisissez-la comme fondatrice.');
  }
  const secId = type === 'holding' ? 'holding' : A ? A.secteur : secteur;
  if (!SECT_BY_ID[secId]) throw new Error('Choisissez un secteur d\'activité.');
  const sec = SECT_BY_ID[secId];
  const b = A ? { source: A.id, part: branche, ca: branche * A.ca, caPipeline: branche * (A.caPipeline || 0), actifs: branche * A.actifs, valeur: branche * valeurEntreprise(s, A) } : null;
  const valeurNature = valeurTitres + (b ? b.valeur : 0);
  const capitalTotal = numeraire + valeurNature;
  const frais = FRAIS_CREATION[type] * numeraire + FRAIS_APPORT_NATURE * valeurNature;
  if (frais > numeraire + 1e-9) throw new Error(`L'apport en numéraire doit couvrir les frais de constitution : ${frais.toFixed(2)} M€ au moins.`);
  const net = numeraire - frais;
  let champs;
  if (type === 'holding') champs = { ca: 0, marge: 0, margeRef: 0, rot: 0, actifs: 0, cash: net, caPipeline: 0 };
  else {
    // Le numéraire finance des actifs neufs (85 %) et la trésorerie de départ (15 %)
    const actifsNeufs = 0.85 * net, cash = 0.15 * net;
    const caCible = actifsNeufs * caParEuro(secId);
    const ca = 0.1 * caCible + (b ? b.ca : 0);
    const caPipeline = caCible - 0.1 * caCible + (b ? b.caPipeline : 0);
    const actifs = actifsNeufs + (b ? b.actifs : 0);
    champs = {
      ca, caPipeline, actifs, cash,
      marge: A ? A.marge : sec.marge * 0.5, margeRef: A ? A.margeRef : sec.marge,
      rot: !(actifs > 0) ? sec.rot : A ? (ca + caPipeline) / actifs : caCible / actifs,
    };
    // La branche garde sa politique de croissance et de R&D ou de marketing
    if (A) for (const k of ['effort', 'croissanceVisee', 'margeLatente']) if (A[k] !== undefined) champs[k] = A[k];
  }
  const provisoire = { secteur: secId, ...champs, dette: 0, actions: 1 };
  const valeurInitiale = prixCible(s, provisoire, valeurTitres);
  const valeurMaturite = type === 'holding' ? valeurInitiale
    : (champs.ca + champs.caPipeline) * champs.margeRef * multiple(s, provisoire) + champs.cash + valeurTitres;
  return {
    type, secteur: secId, numeraire, frais, net, apports, valeurTitres, branche: b, valeurNature, capitalTotal,
    actions: capitalTotal / 10, champs, cash: champs.cash, actifs: champs.actifs,
    caInitial: champs.ca, caCible: champs.ca + champs.caPipeline, valeurInitiale, valeurMaturite,
  };
}

export function creerSociete(s0, fondateur, { type, secteur, nom, capital, titres = {}, branche = 0 }) {
  if (type !== 'operationnelle' && type !== 'holding') throw new Error('Type de société inconnu.');
  if (type === 'operationnelle' && !branche && !SECTEURS.some(x => x.id === secteur)) throw new Error('Choisissez un secteur d\'activité.');
  const s = cloner(s0);
  const ctrl = controlees(s);
  verifierActeur(s, fondateur, ctrl);
  const ap = apercuCreation(s, { type, secteur, capital, fondateur, titres, branche });
  if (!(ap.capitalTotal >= CAPITAL_MIN[type] - 1e-9)) throw new Error(`Capital minimum : ${CAPITAL_MIN[type]} M€, apports en nature compris.`);
  const libelle = String(nom || '').trim().slice(0, 40);
  if (libelle.length < 2) throw new Error('Donnez un nom à la société (deux caractères au moins).');
  if (actives(s).some(c => c.nom.toLowerCase() === libelle.toLowerCase())) throw new Error(`Une société cotée s'appelle déjà ${libelle}.`);
  s.nbFondees = (s.nbFondees || 0) + 1;
  const id = `F${s.nbFondees}`;
  const c = {
    id, nom: libelle, secteur: ap.secteur, active: true,
    ...ap.champs, dette: 0,
    payout: type === 'holding' ? 0 : 0.2,
    actions: ap.actions, prix: ap.valeurInitiale / ap.actions, actionnaires: {},
    detresse: 0, hist: [], histCa: [], sentiment: 0,
    creePar: fondateur, creeAu: s.tour,
  };
  // Le fondateur paie le numéraire : la valeur ajoutée à son portefeuille est celle des actions reçues, moins les titres apportés
  const pfAvant = valeurParticipations(s, fondateur);
  debiter(s, fondateur, ap.numeraire, fondateur === JOUEUR ? ap.valeurInitiale - ap.valeurTitres : 0);
  c.actionnaires = { [fondateur]: c.actions, public: 0 };
  c.hist = [c.prix]; c.histCa = [c.ca];
  s.societes[id] = c; s.ordre.push(id);
  // Apports en nature : les titres changent de mains hors marché, la branche quitte la fondatrice
  for (const a of ap.apports) {
    const d = s.societes[a.id];
    const reste = (d.actionnaires[fondateur] || 0) - a.titres;
    const q = reste < 1e-9 ? d.actionnaires[fondateur] : a.titres;
    if (reste < 1e-9) delete d.actionnaires[fondateur]; else d.actionnaires[fondateur] = reste;
    d.actionnaires[id] = q;
  }
  const A = ap.branche ? s.societes[ap.branche.source] : null;
  if (A) {
    A.ca -= ap.branche.ca; A.caPipeline = (A.caPipeline || 0) - ap.branche.caPipeline; A.actifs -= ap.branche.actifs;
  }
  if (fondateur === JOUEUR && ap.valeurTitres > 0) {
    const pf = valeurParticipations(s, JOUEUR);
    if (s.joueur.marge > MARGE_MAX * pf + 1e-9 && pf < pfAvant - 1e-9)
      throw new Error(`Votre courtier refuse l'apport : votre dette sur marge (${s.joueur.marge.toFixed(1)} M€) dépasserait 50 % du portefeuille (${pf.toFixed(1)} M€ après l'apport, la holding étant décotée).`);
  }
  s.conjSecteurs.holding = s.conjSecteurs.holding || 0;
  const details = [];
  if (ap.numeraire > 0) details.push(`${ap.numeraire.toFixed(1)} M€ en numéraire`);
  if (ap.apports.length) details.push(`des titres ${ap.apports.map(a => s.societes[a.id].nom).join(', ')} pour ${ap.valeurTitres.toFixed(1)} M€`);
  if (A) details.push(`${Math.round(100 * ap.branche.part)} % de l'activité de ${A.nom}, valorisés ${ap.branche.valeur.toFixed(1)} M€`);
  const apport = ap.valeurNature > 0 ? `avec ${ap.capitalTotal.toFixed(1)} M€ de capital (${details.join(', ')})` : `avec ${ap.capitalTotal.toFixed(1)} M€${type === 'holding' ? ' de capital' : ''}`;
  journal(s, 'filiale', type === 'holding'
    ? `${nomDetenteur(s, fondateur)} ${fondateur === JOUEUR ? 'créez' : 'crée'} la holding ${libelle} ${apport}.`
    : `${nomDetenteur(s, fondateur)} ${fondateur === JOUEUR ? 'créez' : 'crée'} ${libelle} (${SECT_BY_ID[ap.secteur].nom}) ${apport} ; chiffre d'affaires visé ${Math.round(ap.caCible)} M€ d'ici deux ans.`, JOUEUR);
  return s;
}

export function journal(s, type, texte, acteur = 'marche') {
  s.journal.unshift({ tour: s.tour, type, texte, acteur });
}
