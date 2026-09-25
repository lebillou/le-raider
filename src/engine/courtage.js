// Finances personnelles d'un acteur : intérêts, appels de marge.
import { actives, valeurParticipations } from './acces.js';
import { JOUEUR, MARGE_APPEL, MARGE_MAX, RAIDERS, compte, nomDetenteur } from './config.js';
import { controlees } from './controle.js';
import { journal } from './creation.js';
import { DECOTE_BLOC } from './marche.js';

// ---------- FINANCES D'UN ACTEUR (joueur ou raider) ----------
// Acteur qui contrôle une société (vous, un raider, ou personne)
export function proprietaireSociete(s, id) {
  if (controlees(s).has(id)) return JOUEUR;
  for (const rd of RAIDERS) if (s.raiders[rd.id]?.actif && controlees(s, rd.id).has(id)) return rd.id;
  return 'marche';
}
export function financesActeur(s, h) {
  const j = compte(s, h);
  const nom = h === JOUEUR ? 'votre courtier' : `le courtier de ${nomDetenteur(s, h)}`;
  j.cash -= j.marge * (s.taux + 0.02) / 4;
  if (j.cash > 0) j.cash += j.cash * Math.max(0, s.taux - 0.01) / 4;
  if (j.cash < 0) { j.marge += -j.cash; j.cash = 0; }
  let pf = valeurParticipations(s, h);
  if (j.marge > MARGE_APPEL * pf && j.marge > 0) {
    journal(s, h === JOUEUR ? 'alerte' : 'concurrent', `Appel de marge : ${nom} cède des blocs avec 15 % de décote (dette ${j.marge.toFixed(1)} M€ pour ${pf.toFixed(1)} M€ de portefeuille).`, h);
    let iter = 0;
    while (j.marge > MARGE_MAX * pf && iter < 80 && pf > 0.01) {
      iter++;
      let best = null, bv = 0;
      for (const c of actives(s)) { const v = (c.actionnaires[h] || 0) * c.prix; if (v > bv) { bv = v; best = c; } }
      if (!best) break;
      // cession de bloc hors marché à 15 % de décote ; l'impact sur le cours dépend de la taille du bloc
      const q = best.actionnaires[h] * 0.2;
      const produit = q * best.prix * (1 - DECOTE_BLOC);
      best.actionnaires[h] -= q; if (best.actionnaires[h] < 1e-9) delete best.actionnaires[h];
      best.actionnaires.public += q; best.prix *= 1 - 0.3 * q / best.actions;
      j.marge -= produit;
      if (j.marge < 0) { j.cash += -j.marge; j.marge = 0; }
      pf = valeurParticipations(s, h);
    }
  } else if (h === JOUEUR && j.marge > MARGE_MAX * pf && j.marge > 0) {
    journal(s, 'alerte', `Marge tendue : dette ${j.marge.toFixed(1)} M€ pour ${pf.toFixed(1)} M€ de portefeuille ; appel de marge au-delà de 60 %.`, JOUEUR);
  }
}
