// Intelligence des raiders concurrents.
import { actives, capi, flottant, pct, valeurParticipations } from './acces.js';
import { gauss } from './alea.js';
import { JOUEUR, RAIDERS, compte, niveauIA } from './config.js';
import { controlees, repartitionControle } from './controle.js';
import { journal } from './creation.js';
import { MANDATS_MAX, _prendreMandat, _restructurer, mandatsDe, peutRestructurer, tailleRemun } from './dirigeants.js';
import { capaciteEmprunt, detteTotale, ebitAnnuel } from './finance.js';
import { acheter, apercuOPA, lancerOPA, vendre } from './marche.js';
import { _emprunter, distribuer } from './pilotage.js';
import { _definirStrategie, croissanceDe, effortDe, parametresEffort } from './strategie.js';
import { estHolding } from './secteurs.js';
import { prixCible } from './valorisation.js';

// ---------- INTELLIGENCE DES RAIDERS ----------
// Chaque raider a une estimation biaisée de la valeur fondamentale, un style,
// un appétit pour l'OPA et pour la dette. Ils agissent en début de trimestre,
// après vos ordres et avant que l'économie ne tourne.
export const estimation = (s, rid, c) => prixCible(s, c) * (1 + (s.raiders[rid].biais[c.id] || 0)) * (s.raiders[rid].humeur || 1);

export function dispoActeur(s, h, margeMax) {
  const j = compte(s, h);
  return j.cash + Math.max(0, margeMax * valeurParticipations(s, h) - j.marge);
}

export function jouerRaiders(s, r) {
  const ctrlJ = controlees(s);
  const ctrlR = {};
  for (const rd of RAIDERS) if (s.raiders[rd.id].actif) ctrlR[rd.id] = controlees(s, rd.id);
  const controleePar = (id) => ctrlJ.has(id) ? JOUEUR : (RAIDERS.find(rd => ctrlR[rd.id]?.has(id))?.id || null);
  // Les fonctions publiques clonent l'état : on rapatrie le clone dans s et on relit les objets ensuite.
  const appliquer = (fn) => { try { Object.assign(s, fn()); return true; } catch (e) { if (globalThis.DEBUG_RAIDER) console.log("refus IA :", e.message); return false; } };

  const niv = niveauIA(s);
  for (const rd of RAIDERS.slice().sort(() => r() - 0.5)) {
    if (!s.raiders[rd.id].actif) continue;
    s.raiders[rd.id].humeur = Math.exp(niv.humeur * gauss(r));   // erreur d'appréciation du trimestre
    const ctrl = ctrlR[rd.id];
    const nomR = rd.nom;

    // 0. Présidences : un raider se fait élire PDG de ses plus grosses sociétés
    {
      const libres = [...ctrl].map(id => s.societes[id]).filter(c => c.active && !c.ceo).sort((a, b) => tailleRemun(b) - tailleRemun(a));
      for (const c of libres) { if (mandatsDe(s, rd.id).length >= MANDATS_MAX) break; _prendreMandat(s, c, rd.id); }
    }
    // 1. Pilotage des filiales : restructurer, distribuer, endetter selon l'appétit
    for (const id of ctrl) {
      const c = s.societes[id];
      if (!c.active) continue;
      if (peutRestructurer(s, c) && r() < niv.restructure) _restructurer(s, c, 'concurrent', rd.id);
      // Stratégie : Lemarchand sacrifie la R&D et la croissance au résultat immédiat ; Vauclair investit
      // là où l'effort rapporte le plus ; Meridian ne s'attarde pas assez pour s'en soucier
      const pe = parametresEffort(c);
      const voulue = !pe ? null
        : rd.style === 'raider' ? { croissance: -0.02, effort: 0.5 * pe.norme }
        : rd.style === 'valeur' && pe.efficacite >= 1.2 ? { croissance: 0, effort: pe.norme + 0.02 }
        : null;
      if (voulue && (Math.abs(croissanceDe(c) - voulue.croissance) > 1e-9 || Math.abs(effortDe(c) - voulue.effort) > 1e-9)) _definirStrategie(s, c, voulue, 'concurrent', rd.id);
      c.payout = rd.payout;
      if (rd.levierMax > 0) {
        const cap = Math.min(capaciteEmprunt(c, s), estHolding(c) ? Infinity : rd.levierMax * ebitAnnuel(c) - detteTotale(c));
        if (cap > Math.max(1, 0.02 * c.ca) && r() < 0.7) _emprunter(s, c, cap * 0.9, 'concurrent', rd.id);
      }
      if (rd.style !== 'valeur') {
        const exces = c.cash - 0.06 * c.ca;
        if (exces > Math.max(0.5, 0.02 * c.ca)) {
          distribuer(s, c, exces);
          journal(s, 'concurrent', `${c.nom} verse un dividende exceptionnel de ${exces.toFixed(1)} M€ à la demande de ${nomR}.`, rd.id);
        }
      }
    }

    // 2. Marge tendue : alléger les positions non stratégiques
    let ventes = 0;   // au plus une vente par trimestre, une OPA, un achat : un rythme humain
    {
      const cp = s.raiders[rd.id];
      const pf = valeurParticipations(s, rd.id);
      if (cp.marge > 0.8 * rd.margeMax * pf && cp.marge > 0) {
        const pos = actives(s).filter(c => c.actionnaires[rd.id] > 0 && !ctrl.has(c.id)).sort((a, b) => b.actionnaires[rd.id] * b.prix - a.actionnaires[rd.id] * a.prix).slice(0, 1).map(c => c.id);
        for (const id of pos) if (appliquer(() => vendre(s, rd.id, id, s.societes[id].actionnaires[rd.id] * 0.5))) ventes++;
      }
    }

    // 3. Prises de bénéfice : vendre ce qui cote nettement au-dessus de l'estimation ou du prix d'entrée
    for (const id of s.ordre) {
      const c = s.societes[id];
      if (ventes >= 1 || !c.active || !(c.actionnaires[rd.id] > 0) || ctrl.has(c.id)) continue;
      const ratio = c.prix / estimation(s, rd.id, c);
      const seuil = rd.style === 'valeur' ? 1.15 : 1.25;
      const entree = s.raiders[rd.id].acquis[c.id];
      if (ratio > seuil || (rd.style === 'opportuniste' && entree > 0 && c.prix > 1.35 * entree)) {
        if (appliquer(() => vendre(s, rd.id, id, s.societes[id].actionnaires[rd.id]))) ventes++;
      }
    }

    // 4. OPA : une cible libre, abordable, pas trop chère par rapport à l'estimation
    if (r() < rd.pOpa * niv.audace) {
      let meilleure = null, score = -1;
      const ctlIA = repartitionControle(s);
      for (const c of actives(s)) {
        if (controleePar(c.id)) continue;
        const ratio = c.prix / estimation(s, rd.id, c);
        if (ratio > rd.surcoteMax) continue;
        let prime = null;
        for (const p of [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45]) {
          if (p > rd.primeMax + 1e-9) break;
          const ap = apercuOPA(s, rd.id, c.id, p, 1, ctlIA);
          if (ap.prendControle) { prime = p; break; }
        }
        if (prime === null) continue;
        const ap = apercuOPA(s, rd.id, c.id, prime, 1, ctlIA);
        if (ap.cout > dispoActeur(s, rd.id, rd.margeMax) * 0.9) continue;
        const partJ = pct(c, JOUEUR);
        const sc = (1.3 - ratio) + (c.actionnaires[rd.id] ? 0.3 : 0) + (rd.style !== 'valeur' && partJ > 0.1 && partJ < 0.5 ? 0.4 : 0) - prime * 0.5;
        if (sc > score) { score = sc; meilleure = { id: c.id, prime }; }
      }
      if (meilleure && appliquer(() => lancerOPA(s, rd.id, meilleure.id, meilleure.prime))) ctrlR[rd.id] = controlees(s, rd.id);
    }

    // 5. Achats de blocs (au niveau normal, un trimestre sur quatre environ, il n'achète rien)
    let achats = r() < niv.sansAchat ? niv.achats : 0;
    const budget = () => dispoActeur(s, rd.id, rd.margeMax) * (rd.style === 'valeur' ? 0.25 : 0.2);
    const candidats = actives(s).filter(c => !ctrlR[rd.id].has(c.id) && flottant(c) / c.actions > 0.15).map(c => {
      const ratio = c.prix / estimation(s, rd.id, c);
      const partJ = pct(c, JOUEUR);
      let attrait = 0.97 - ratio;                                                                                  // décote perçue
      if (rd.style === 'opportuniste' && partJ > 0.05 && partJ < 0.5 && !ctrlJ.has(c.id)) attrait += 0.25;      // se glisser dans vos cibles
      if (rd.style === 'raider' && capi(c) < 200 && !controleePar(c.id)) attrait += 0.08;                        // préparer une OPA
      if (c.actionnaires[rd.id] > 0 && pct(c, rd.id) > 0.2) attrait -= 0.15;                                     // ne pas surconcentrer
      return { id: c.id, attrait };
    }).filter(x => x.attrait > 0.08).sort((a, b) => b.attrait - a.attrait);
    for (const { id } of candidats) {
      if (achats >= niv.achats) break;
      const b = budget();
      if (b < 1) break;
      const c = s.societes[id];
      const montant = Math.min(b, capi(c) * (0.03 + 0.04 * r()));
      if (montant < 0.5) continue;
      const prixEntree = c.prix;
      if (appliquer(() => acheter(s, rd.id, id, montant))) { achats++; s.raiders[rd.id].acquis[id] = prixEntree; ctrlR[rd.id] = controlees(s, rd.id); }
    }
  }
}
