// Clôture d'un trimestre : conjoncture, exploitation, faillites, cours, fin de partie.
import { actives, fortune, valeurParticipations, valeurPortefeuille } from './acces.js';
import { gauss, rngDe } from './alea.js';
import { IMPOT, JOUEUR, RAIDERS, clamp, compte, difficulte } from './config.js';
import { controlees, detentionEffective, repartitionControle } from './controle.js';
import { financesActeur, proprietaireSociete } from './courtage.js';
import { MONTEE_EN_CHARGE, journal } from './creation.js';
import { IMPOT_REVENU, _finMandat, fixeAnnuel, gererMandats } from './dirigeants.js';
import { couponsAnnuels, detteTotale, ebitAnnuel, levier, ltv, tauxEmprunt } from './finance.js';
import { jouerRaiders } from './ia.js';
import { DECOTE_BLOC } from './marche.js';
import { traiterEcheances } from './obligations.js';
import { SECTEURS, SECT_BY_ID, estHolding } from './secteurs.js';
import { croissanceSecteur, evolutionStrategique } from './strategie.js';
import { compteCourant, tauxCompteCourant } from './comptes.js';
import { cloner, crediter } from './transactions.js';
import { prixCible } from './valorisation.js';

// ---------- FIN DE TRIMESTRE ----------
export const EVENEMENTS = [
  { id: 'petrole', p: 0.03, texte: 'Choc pétrolier : les énergéticiens flambent, le transport encaisse.', effet: (s) => { s.conjSecteurs.energie += 0.6; s.conjSecteurs.transport -= 0.5; } },
  { id: 'crise', defavorable: true, p: 0.025, texte: 'Crise de confiance : la conjoncture se retourne brutalement.', effet: (s) => { s.conj = clamp(s.conj - 0.6, -1, 1); } },
  { id: 'boom', p: 0.03, texte: 'Euphorie technologique : les valeurs de croissance s\'envolent.', effet: (s) => { s.conjSecteurs.techno += 0.6; } },
  { id: 'baisse', p: 0.04, texte: 'La banque centrale abaisse ses taux plus vite que prévu.', effet: (s) => { s.taux = clamp(s.taux - 0.0075, 0.005, 0.15); } },
  { id: 'hausse', defavorable: true, p: 0.04, texte: 'Poussée d\'inflation : la banque centrale relève ses taux.', effet: (s) => { s.taux = clamp(s.taux + 0.0075, 0.005, 0.15); } },
  { id: 'scandale', defavorable: true, p: 0.05, cible: true, texte: (c) => `Scandale comptable chez ${c.nom} : le titre décroche de 25 %.`, effet: (s, c) => { c.prix *= 0.75; c.ca *= 0.95; c.marge *= 0.9; } },
  { id: 'rumeur', p: 0.05, cible: true, texte: (c) => `Rumeur d'offre sur ${c.nom} : le titre bondit de 18 %.`, effet: (s, c) => { c.prix *= 1.18; } },
  { id: 'contrat', p: 0.05, cible: true, texte: (c) => `${c.nom} remporte un contrat majeur : chiffre d'affaires +10 %.`, effet: (s, c) => { c.ca *= 1.10; } },
  { id: 'greve', defavorable: true, p: 0.04, cible: true, texte: (c) => `Grève dure chez ${c.nom} : un trimestre de production perdu.`, effet: (s, c) => { c.cash -= 0.03 * c.ca; } },
  { id: 'immo', defavorable: true, p: 0.02, texte: 'Retournement immobilier : les foncières se replient, les banques provisionnent.', effet: (s) => { s.conjSecteurs.immo -= 0.6; s.conjSecteurs.banque -= 0.3; } },
];

export function finTrimestre(s0) {
  const s = cloner(s0);
  if (s.fini) return s;
  const r = rngDe(s);
  s.tour += 1;
  const ctrlAvant = controlees(s);
  s.offres = [];
  jouerRaiders(s, r);

  // 1. Conjoncture et taux
  s.conj = clamp(0.85 * s.conj + 0.12 * gauss(r), -1, 1);
  for (const sec of SECTEURS) s.conjSecteurs[sec.id] = clamp(0.7 * s.conjSecteurs[sec.id] + 0.09 * gauss(r), -1, 1);
  s.taux = clamp(s.taux + 0.15 * (0.045 + 0.02 * s.conj - s.taux) + 0.002 * gauss(r), 0.005, 0.15);

  // 2. Événements
  const socs = actives(s);
  const dif = difficulte(s);
  for (const ev of EVENEMENTS) {
    if (r() > ev.p * (ev.defavorable ? dif.evenements : 1)) continue;
    if (ev.cible) {
      const c = socs[Math.floor(r() * socs.length)];
      ev.effet(s, c); journal(s, 'evenement', ev.texte(c));
    } else { ev.effet(s); journal(s, 'evenement', ev.texte); }
  }

  // 3. Exploitation de chaque société
  const dividendes = {};   // encaissements reportés pour ne pas mêler ordre et effets
  const remunerations = {};
  const interetsCC = {};   // intérêts des comptes courants, versés aux prêteurs
  for (const c of actives(s)) {
    const sec = SECT_BY_ID[c.secteur];
    const conj = clamp(sec.beta * s.conj + s.conjSecteurs[c.secteur], -1.2, 1.2);
    const g = croissanceSecteur(c) + 0.05 * conj + 0.015 * gauss(r);
    c.ca *= 1 + g / 4;
    // Stratégie : parts de marché gagnées ou cédées, effets de la R&D ou du marketing sur la marge cible
    evolutionStrategique(c);
    // Montée en charge des investissements et des créations
    if (c.caPipeline > 0.01) { const d = c.caPipeline * MONTEE_EN_CHARGE; c.ca += d; c.caPipeline -= d; c.caPipeline *= 1 + g / 4; }
    else c.caPipeline = 0;
    // La marge revient vers sa référence, modulée par la conjoncture
    c.marge = clamp(c.marge + 0.25 * (c.margeRef * (1 + 0.5 * conj) - c.marge) + 0.004 * gauss(r), -0.15, 0.6);
    const ebitT = ebitAnnuel(c) / 4;
    let interets = c.dette * tauxEmprunt(s, c) / 4 + couponsAnnuels(c) / 4 - Math.max(0, c.cash) * Math.max(0, s.taux - 0.01) / 4;
    for (const [h, m] of Object.entries(c.comptesCourants || {})) {
      const i = m * tauxCompteCourant(s) / 4;
      interets += i; interetsCC[h] = (interetsCC[h] || 0) + i;
    }
    // Fixe du dirigeant : charge déductible, versée chaque trimestre
    const fixeT = c.ceo ? fixeAnnuel(c) / 4 : 0;
    if (fixeT > 0) {
      const net = fixeT * (1 - IMPOT_REVENU);
      remunerations[c.ceo.h] = (remunerations[c.ceo.h] || 0) + net;
      c.ceo.percu += net;
    }
    const rb = ebitT - interets - fixeT;
    const rn = rb > 0 ? rb * (1 - IMPOT) : rb;
    c.cash += rn;
    c.dernierRN = rn * 4;
    const baseDiv = rn + (c.divRecus || 0);    // les dividendes reçus des participations alimentent la distribution
    const div = baseDiv > 0 && c.cash > 0 ? Math.min(baseDiv * c.payout, c.cash) : 0;
    if (div > 0) {
      for (const [h, t] of Object.entries(c.actionnaires)) {
        if (h === 'public' || h === 'noyau') continue;
        dividendes[h] = (dividendes[h] || 0) + div * t / c.actions;
      }
      c.cash -= div;
    }
    c.dernierDiv = div / c.actions;
    // Détresse : trésorerie négative refinancée à taux punitif
    if (c.cash < 0) {
      c.dette += -c.cash * 1.05; c.cash = 0;
    }
    c.detresse = (rb < 0 && c.cash < 0.02 * c.ca) ? c.detresse + 1 : 0;
  }
  for (const c of actives(s)) c.divRecus = dividendes[c.id] || 0;
  for (const [h, m] of Object.entries(dividendes)) crediter(s, h, m);
  for (const [h, m] of Object.entries(interetsCC)) if (h === JOUEUR || s.raiders[h]?.actif) crediter(s, h, m);
  for (const [h, m] of Object.entries(remunerations)) {
    if (h !== JOUEUR && !s.raiders[h]?.actif) continue;
    crediter(s, h, m);
    compte(s, h).remTotale = (compte(s, h).remTotale || 0) + m;
  }

  // 3 bis. Échéances obligataires
  traiterEcheances(s, repartitionControle(s));

  // 4. Faillites
  for (const c of actives(s)) {
    const l = levier(c);
    const actifsTotaux = c.actifs + Math.max(0, c.cash) + valeurParticipations(s, c.id);
    const dt = detteTotale(c);
    const enFaillite = estHolding(c) ? dt > actifsTotaux + 1e-6 && dt > 0.01
      : ((l > 8 && c.detresse >= 2) || c.detresse >= 4 || dt > 1.2 * actifsTotaux);
    if (enFaillite) {
      if (c.ceo) _finMandat(s, c, 'liquidation');
      c.active = false; c.faillite = true; c.prix = 0;
      s.stats.faillites++;
      const partJ = detentionEffective(s, c.id, ctrlAvant);
      const ccJ = compteCourant(c);
      journal(s, 'faillite', `${c.nom} est placée en liquidation judiciaire ; les actionnaires perdent tout${partJ > 0.01 ? ` (vous déteniez ${Math.round(100 * partJ)} %)` : ''}${ccJ > 0.05 ? `, et votre compte courant de ${ccJ.toFixed(1)} M€ est perdu` : ''}.`);
      for (const d of actives(s)) if (d.actionnaires[c.id]) { d.actionnaires.public += d.actionnaires[c.id]; delete d.actionnaires[c.id]; }
      s.offres = s.offres.filter(o => o.cible !== c.id);
    }
  }

  // 5. Cours : le marché suit la valeur fondamentale déformée par un sentiment persistant
  let valAvant = 0, valApres = 0;
  for (const c of actives(s)) valAvant += c.actions * c.prix;
  for (const c of actives(s)) {
    c.sentiment = clamp(0.92 * (c.sentiment || 0) + 0.05 * gauss(r), -0.5, 0.5);
    const cible = prixCible(s, c) * Math.exp(c.sentiment);
    const vol = SECT_BY_ID[c.secteur].vol * dif.volatilite;
    c.prix = Math.max(0.01, c.prix * Math.exp(0.25 * Math.log(cible / c.prix) + vol * gauss(r)));
    c.hist.push(c.prix); if (c.hist.length > 24) c.hist.shift();
    c.histCa.push(c.ca); if (c.histCa.length > 24) c.histCa.shift();
    valApres += c.actions * c.prix;
  }
  s.indice = (s.indice || 100) * (valAvant > 0 ? valApres / valAvant : 1);   // indice de marché pondéré

  // 5 bis. Covenants bancaires des holdings : au-delà de 75 % de LTV, la banque fait céder des blocs
  for (const c of actives(s)) {
    if (!estHolding(c) || c.dette <= 0.01 || ltv(s, c) <= 0.75) continue;
    journal(s, 'alerte', `Covenant rompu chez ${c.nom} (LTV ${Math.round(100 * ltv(s, c))} %) : la banque fait céder des blocs avec 15 % de décote.`, proprietaireSociete(s, c.id));
    let iter = 0;
    while (ltv(s, c) > 0.5 && c.dette > 0.01 && iter < 60) {
      iter++;
      let best = null, bv = 0;
      for (const d of actives(s)) { const v = (d.actionnaires[c.id] || 0) * d.prix; if (v > bv) { bv = v; best = d; } }
      if (!best) break;
      const q = best.actionnaires[c.id] * 0.25;
      const produit = q * best.prix * (1 - DECOTE_BLOC);
      best.actionnaires[c.id] -= q; if (best.actionnaires[c.id] < 1e-9) delete best.actionnaires[c.id];
      best.actionnaires.public = (best.actionnaires.public || 0) + q; best.prix *= 1 - 0.3 * q / best.actions;
      const remb = Math.min(produit, c.dette); c.dette -= remb; c.cash += produit - remb;
    }
  }

  // 5 ter. Mandats de dirigeants : révocations, levées d'options, revues annuelles
  gererMandats(s, repartitionControle(s));

  // 6. Finances des acteurs : intérêts, appels de marge
  for (const h of [JOUEUR, ...RAIDERS.map(x => x.id)]) {
    if (h !== JOUEUR && !s.raiders[h].actif) continue;
    financesActeur(s, h);
  }
  const j = s.joueur;
  let pf = valeurPortefeuille(s);
  const f = fortune(s);
  j.histFortune.push(f); j.fortuneMax = Math.max(j.fortuneMax, f);

  // 7. Changements de contrôle par effet mécanique, faillites personnelles des raiders
  const ctrlApres = controlees(s);
  for (const id of ctrlAvant) if (!ctrlApres.has(id) && s.societes[id].active) journal(s, 'alerte', `Vous perdez le contrôle de ${s.societes[id].nom}.`, JOUEUR);
  for (const rd of RAIDERS) {
    const cp = s.raiders[rd.id];
    if (!cp.actif) continue;
    const fr = fortune(s, rd.id);
    cp.histFortune.push(fr);
    if (fr < 0) {
      cp.actif = false;
      for (const c of actives(s)) if (c.actionnaires[rd.id]) { c.actionnaires.public += c.actionnaires[rd.id]; delete c.actionnaires[rd.id]; c.prix *= 0.92; }
      cp.cash = 0; cp.marge = 0;
      s.offres = s.offres.filter(o => o.acteur !== rd.id);
      journal(s, 'concurrent', `${rd.nom} est en cessation de paiements : ses positions sont liquidées sur le marché.`, rd.id);
    }
  }

  // 8. Fin de partie
  if (f < 0 || (pf < 0.01 && j.cash < 0.01 && j.marge > 0.01)) {
    s.fini = { raison: 'ruine', fortune: f };
    journal(s, 'fin', 'Ruine : votre courtier a tout liquidé et il reste une dette. La partie est terminée.', JOUEUR);
  } else if (s.tour >= s.nbTours) {
    s.fini = { raison: 'terme', fortune: f };
    journal(s, 'fin', `${s.nbTours / 4} ans écoulés. Fortune finale : ${Math.round(f)} M€ — ${titre(f)}.`, 'marche');
  }
  return s;
}

export function prolonger(s0, ans = 10) {
  const s = cloner(s0);
  if (!s.fini || s.fini.raison !== 'terme') throw new Error('Seule une partie arrivée à son terme peut être prolongée.');
  s.nbTours += 4 * ans; s.fini = null;
  journal(s, 'info', `La partie est prolongée de ${ans} ans : ${s.nbTours / 4} ans au total.`, 'marche');
  return s;
}
export function titre(f) {
  if (f < 25) return 'Petit porteur';
  if (f < 100) return 'Investisseur';
  if (f < 400) return 'Financier';
  if (f < 1500) return 'Raider';
  if (f < 5000) return 'Tycoon';
  return 'Magnat';
}

export const fmtOptions = (t) => t >= 1 ? `${t.toFixed(2)} M options` : `${Math.round(t * 1000)} k options`;
export const fmtTitres = (t) => t >= 1 ? `${t.toFixed(2)} M titres` : `${Math.round(t * 1000)} k titres`;
export const libelleTour = (tour) => `T${(tour % 4) + 1} ${2026 + Math.floor(tour / 4)}`;
