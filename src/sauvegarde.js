// Sauvegarde automatique de la partie en cours, dans le stockage local du navigateur
// (ou de la fenêtre de l'application Mac, qui dispose du même stockage).
// La clé change quand le format de l'état change : une ancienne sauvegarde est alors ignorée.
import { verifierInvariants } from './engine/index.js';

export const CLE = 'raider-partie-v7';

function stockage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch (e) { return null; }
}

export async function charger() {
  try {
    const brut = stockage()?.getItem(CLE);
    return brut ? JSON.parse(brut) : null;
  } catch (e) {
    return null;
  }
}

export async function sauver(s) {
  try { stockage()?.setItem(CLE, JSON.stringify(s)); } catch (e) { /* stockage plein ou indisponible : la partie continue sans sauvegarde */ }
}

// Préférences d'affichage, propres à ce navigateur (résumé de clôture...) : une valeur absente ou illisible donne la valeur par défaut
export function lirePreference(nom, defaut) {
  try { const v = stockage()?.getItem(`raider-pref-${nom}`); return v === null || v === undefined ? defaut : JSON.parse(v); } catch (e) { return defaut; }
}
export function ecrirePreference(nom, valeur) {
  try { stockage()?.setItem(`raider-pref-${nom}`, JSON.stringify(valeur)); } catch (e) { /* stockage indisponible : la préférence vaut pour la session */ }
}

// ---------- EXPORT ET IMPORT ----------
// Une sauvegarde exportée est un fichier JSON : l'état de la partie, enveloppé avec la clé de format.
// Elle passe d'un navigateur à l'autre, ou de la version web à l'application de bureau.
export const FORMAT = 'le-raider';
export function exporterPartie(s) {
  return JSON.stringify({ format: FORMAT, cle: CLE, exporteLe: new Date().toISOString(), etat: s });
}
export function importerPartie(texte) {
  let d;
  try { d = JSON.parse(String(texte).trim()); } catch (e) { throw new Error('Ce texte n\'est pas une sauvegarde lisible : le contenu n\'est pas du JSON valide.'); }
  const enveloppe = d && d.format === FORMAT;
  if (enveloppe && d.cle !== CLE) throw new Error(`Cette sauvegarde vient d'une version incompatible du jeu (format ${d.cle}, attendu ${CLE}).`);
  const etat = enveloppe ? d.etat : d;
  const ok = etat && typeof etat === 'object' && etat.societes && Array.isArray(etat.ordre) && etat.joueur && etat.raiders && Array.isArray(etat.journal) && Number.isFinite(etat.tour);
  if (!ok) throw new Error('Ce fichier ne contient pas une partie du Raider.');
  const erreurs = verifierInvariants(etat);
  if (erreurs.length) throw new Error(`Sauvegarde incohérente, chargement refusé : ${erreurs[0]}.`);
  return etat;
}
