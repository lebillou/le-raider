// Résumé d'une clôture de trimestre et tri du journal : ce qui vous concerne, le reste, la routine.
import { actives, fortune } from './acces.js';
import { JOUEUR, RAIDERS } from './config.js';
import { controlees } from './controle.js';
import { libelleTour } from './trimestre.js';
import { resultatNetAnnuel } from './valorisation.js';

// ---------- ROUTINE DES RAIDERS ----------
// Opérations courantes d'un raider : utiles à l'historique, sans intérêt au fil de la partie.
const ROUTINE = /verse un dividende exceptionnel|emprunte [\d.]+ M€|revoit sa stratégie|lance un plan de restructuration|^Revue annuelle de la direction|est élu PDG|lève [\d.]+ [kM] options|fixe son taux de distribution| vend à découvert |vendus à découvert, à |options .* expirent sans valeur| achète [\d.]+ [kM] titres | cède [\d.]+ [kM] titres /;
// Nature d'une opération courante, pour les regrouper : [singulier, pluriel]
const NATURES = [
  [/découvert/, ['opération à découvert', 'opérations à découvert']],
  [/ achète /, ['achat', 'achats']], [/ cède /, ['vente', 'ventes']], [/dividende exceptionnel/, ['dividende exceptionnel', 'dividendes exceptionnels']],
  [/emprunte/, ['emprunt', 'emprunts']], [/restructuration/, ['restructuration', 'restructurations']], [/revoit sa stratégie/, ['révision de stratégie', 'révisions de stratégie']],
  [/taux de distribution/, ['politique de dividende', 'politiques de dividende']], [/options|PDG|direction/, ['opération de mandat', 'opérations de mandat']],
];
export const natureRoutine = (e) => (NATURES.find(([re]) => re.test(e.texte)) || [null, ['opération', 'opérations']])[1];
// « 2 achats, 1 dividende exceptionnel » à partir d'une liste d'entrées courantes
export function decrireRoutine(entrees) {
  const n = new Map();
  for (const e of entrees) { const k = natureRoutine(e); n.set(k, (n.get(k) || 0) + 1); }
  return [...n].sort((a, b) => b[1] - a[1]).map(([[sg, pl], k]) => `${k} ${k > 1 ? pl : sg}`).join(', ');
}
export const estRoutine = (e) => e.acteur !== JOUEUR && e.acteur !== 'marche' && ROUTINE.test(e.texte);

// Sociétés qui vous intéressent : celles où vous avez des titres, que votre groupe contrôle ou que vous vendez à découvert
export function societesDuJoueur(s) {
  const ctrl = controlees(s);
  const ids = new Set(ctrl);
  for (const c of actives(s)) if ((c.actionnaires[JOUEUR] || 0) > 0) ids.add(c.id);
  for (const id of Object.keys(s.joueur.courtes || {})) ids.add(id);
  return ids;
}
const mentionne = (s, e, ids) => [...ids].some(id => s.societes[id] && e.texte.includes(s.societes[id].nom));

// ---------- RÉSUMÉ DE CLÔTURE ----------
// avant : l'état au moment de clôturer ; apres : l'état renvoyé par finTrimestre.
export function resumeTrimestre(avant, apres) {
  const ids = new Set([...societesDuJoueur(avant), ...societesDuJoueur(apres)]);
  const entrees = apres.journal.filter(e => e.tour === apres.tour);   // écrites pendant la clôture
  const vous = [], concurrents = [], marche = [];
  const courantes = [];
  for (const e of entrees) {
    if (e.acteur === JOUEUR || mentionne(apres, e, ids)) vous.push(e);
    else if (estRoutine(e)) courantes.push(e);
    else if (e.acteur === 'marche') marche.push(e);
    else concurrents.push(e);
  }
  const ctrl = controlees(apres);
  const lignes = [...ids].map(id => {
    const a = avant.societes[id], b = apres.societes[id];
    if (!a || !b) return null;
    const titres = (x) => (x.actionnaires[JOUEUR] || 0);
    return {
      id, nom: b.nom, controlee: ctrl.has(id), active: b.active,
      prixAvant: a.prix, prixApres: b.active ? b.prix : 0,
      valeurApres: titres(b) * (b.active ? b.prix : 0), courte: apres.joueur.courtes?.[id]?.titres || 0,
      resultat: b.active ? resultatNetAnnuel(apres, b) : null,
    };
  }).filter(Boolean).sort((x, y) => (y.controlee - x.controlee) || (y.valeurApres - x.valeurApres));
  const rang = (s) => 1 + RAIDERS.filter(r => s.raiders[r.id].actif && fortune(s, r.id) > fortune(s)).length;
  return {
    periode: libelleTour(avant.tour),
    fortuneAvant: fortune(avant), fortuneApres: fortune(apres), rangAvant: rang(avant), rangApres: rang(apres),
    indice: (apres.indice || 100) / (avant.indice || 100) - 1, tauxAvant: avant.taux, tauxApres: apres.taux, conj: apres.conj,
    vous, concurrents, marche, routine: courantes.length, descriptionRoutine: decrireRoutine(courantes), lignes, fini: apres.fini,
  };
}
