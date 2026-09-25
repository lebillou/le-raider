// Création de sociétés d'exploitation et de holdings ; journal.
import { actives } from './acces.js';
import { JOUEUR, nomDetenteur } from './config.js';
import { controlees } from './controle.js';
import { SECTEURS, SECT_BY_ID } from './secteurs.js';
import { cloner, debiter, verifierActeur } from './transactions.js';
import { multiple, prixCible } from './valorisation.js';

// ---------- CRÉATION DE SOCIÉTÉS ----------
export const CAPITAL_MIN = { operationnelle: 5, holding: 2 };
export const FRAIS_CREATION = { operationnelle: 0.02, holding: 0.005 };
export const MONTEE_EN_CHARGE = 0.125;       // part du CA en construction qui entre en exploitation chaque trimestre (≈ 2 ans)
// Chiffre d'affaires obtenu à maturité par euro investi : calibré pour qu'un euro investi
// vaille ~1,15 € une fois l'activité en régime, quel que soit le secteur.
export const RENDEMENT_INVEST = 1.15;
export const caParEuro = (secId) => RENDEMENT_INVEST / (SECT_BY_ID[secId].marge * SECT_BY_ID[secId].mult);

export function apercuCreation(s, { type, secteur, capital }) {
  const frais = FRAIS_CREATION[type] * capital;
  const net = capital - frais;
  if (type === 'holding') return { frais, cash: net, actifs: 0, caInitial: 0, caCible: 0, valeurInitiale: net, valeurMaturite: net };
  const sec = SECT_BY_ID[secteur];
  const actifs = 0.85 * net, cash = 0.15 * net;
  const caCible = actifs * caParEuro(secteur);
  const c = { secteur, ca: 0.1 * caCible, marge: sec.marge * 0.5, margeRef: sec.marge, caPipeline: 0.9 * caCible, dette: 0, cash, actions: 1 };
  const valeurInitiale = prixCible(s, c);
  const valeurMaturite = caCible * sec.marge * multiple(s, c) + cash;
  return { frais, cash, actifs, caInitial: 0.1 * caCible, caCible, valeurInitiale, valeurMaturite };
}

export function creerSociete(s0, fondateur, { type, secteur, nom, capital }) {
  if (type !== 'operationnelle' && type !== 'holding') throw new Error('Type de société inconnu.');
  if (type === 'operationnelle' && !SECTEURS.some(x => x.id === secteur)) throw new Error('Choisissez un secteur d\'activité.');
  if (!(capital >= CAPITAL_MIN[type])) throw new Error(`Capital minimum : ${CAPITAL_MIN[type]} M€.`);
  const libelle = String(nom || '').trim().slice(0, 40);
  if (libelle.length < 2) throw new Error('Donnez un nom à la société (deux caractères au moins).');
  const s = cloner(s0);
  const ctrl = controlees(s);
  verifierActeur(s, fondateur, ctrl);
  if (actives(s).some(c => c.nom.toLowerCase() === libelle.toLowerCase())) throw new Error(`Une société cotée s'appelle déjà ${libelle}.`);
  const ap = apercuCreation(s, { type, secteur, capital });
  s.nbFondees = (s.nbFondees || 0) + 1;
  const id = `F${s.nbFondees}`;
  const secId = type === 'holding' ? 'holding' : secteur;
  const sec = SECT_BY_ID[secId];
  const c = {
    id, nom: libelle, secteur: secId, active: true,
    ca: ap.caInitial, marge: sec.marge * 0.5, margeRef: sec.marge, rot: type === 'holding' ? 0 : ap.caCible / ap.actifs,
    actifs: ap.actifs, dette: 0, cash: ap.cash, caPipeline: type === 'holding' ? 0 : ap.caCible - ap.caInitial,
    payout: type === 'holding' ? 0 : 0.2,
    actions: capital / 10, prix: 10, actionnaires: {},
    detresse: 0, hist: [], histCa: [], sentiment: 0,
    creePar: fondateur, creeAu: s.tour,
  };
  // Le fondateur paie le capital : la valeur ajoutée à son portefeuille est la valeur de marché initiale
  c.prix = ap.valeurInitiale / c.actions;
  debiter(s, fondateur, capital, fondateur === JOUEUR ? ap.valeurInitiale : 0);
  c.actionnaires = { [fondateur]: c.actions, public: 0 };
  c.hist = [c.prix]; c.histCa = [c.ca];
  s.societes[id] = c; s.ordre.push(id);
  s.conjSecteurs.holding = s.conjSecteurs.holding || 0;
  journal(s, 'filiale', type === 'holding'
    ? `${nomDetenteur(s, fondateur)} ${fondateur === JOUEUR ? 'créez' : 'crée'} la holding ${libelle} avec ${capital.toFixed(1)} M€ de capital.`
    : `${nomDetenteur(s, fondateur)} ${fondateur === JOUEUR ? 'créez' : 'crée'} ${libelle} (${SECT_BY_ID[secId].nom}) avec ${capital.toFixed(1)} M€ ; chiffre d'affaires visé ${Math.round(ap.caCible)} M€ d'ici deux ans.`, JOUEUR);
  return s;
}

export function journal(s, type, texte, acteur = 'marche') {
  s.journal.unshift({ tour: s.tour, type, texte, acteur });
}
