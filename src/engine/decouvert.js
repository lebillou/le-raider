// Ventes à découvert : emprunter des titres au flottant, les vendre, les racheter plus tard.
import { actives, fortune, societe } from './acces.js';
import { COMMISSION, IMPACT, JOUEUR, RAIDERS, RAIDER_BY_ID, compte } from './config.js';
import { controlees } from './controle.js';
import { journal } from './creation.js';
import { cloner, crediter, debiter } from './transactions.js';
import { fmtTitres } from './trimestre.js';

// ---------- VENTES À DÉCOUVERT ----------
// Les titres sont empruntés à des porteurs du flottant et revendus aussitôt sur le marché : la répartition
// du capital ne change pas (le flottant prête d'une main et rachète de l'autre), seul le vendeur doit
// désormais des titres. Il encaisse le produit, paie chaque trimestre le prêt des titres et les dividendes
// dus au prêteur, et gagne si le cours baisse. Une faillite solde la dette à zéro ; une absorption la
// convertit à la parité. Le courtier exige que l'exposition reste couverte par la fortune nette, et le
// prêteur rappelle ses titres si le flottant devient trop étroit : ces rachats forcés se font avec une prime.
export const MONTANT_DECOUVERT_MIN = 0.5;
export const TAUX_PRET_TITRES = 0.02;        // coût annuel de l'emprunt de titres, sur leur valeur
export const LEVIER_DECOUVERT = 1;           // exposition courte ≤ fortune nette à l'ouverture
export const APPEL_DECOUVERT = 1.5;          // au-delà, le courtier fait racheter à la clôture
export const PART_PRETABLE = 0.2;            // part du flottant disponible au prêt, tous vendeurs confondus
export const RAPPEL_FLOTTANT = 0.5;          // au-delà de cette part du flottant, les prêteurs rappellent leurs titres
export const PRIME_RACHAT_FORCE = 0.05;

export const positionsCourtes = (s, h = JOUEUR) => compte(s, h).courtes || {};
export const titresCourts = (s, id, h = JOUEUR) => positionsCourtes(s, h)[id]?.titres || 0;
const acteurs = (s) => [JOUEUR, ...RAIDERS.map(r => r.id).filter(id => s.raiders[id])];
export function expositionCourte(s, h = JOUEUR) {
  let v = 0;
  for (const [id, p] of Object.entries(positionsCourtes(s, h))) { const c = s.societes[id]; if (c?.active) v += p.titres * c.prix; }
  return v;
}
export const totalCourt = (s, id) => acteurs(s).reduce((a, h) => a + titresCourts(s, id, h), 0);
export const capaciteDecouvert = (s, h = JOUEUR) => Math.max(0, LEVIER_DECOUVERT * fortune(s, h) - expositionCourte(s, h));
export const pretable = (s, c) => Math.max(0, PART_PRETABLE * (c.actionnaires.public || 0) - totalCourt(s, c.id));

// Vente de titres empruntés : même impact sur le cours qu'une vente ordinaire
export function apercuVenteDecouvert(s, id, montant, h = JOUEUR) {
  const c = societe(s, id);
  if (!(montant >= MONTANT_DECOUVERT_MIN)) throw new Error(`Montant minimum : ${MONTANT_DECOUVERT_MIN} M€.`);
  const q = montant / c.prix;
  const impact = Math.min(0.9, IMPACT * q / c.actions);
  const prixMoyen = c.prix * (1 - impact / 2);
  const produit = q * prixMoyen * (1 - COMMISSION);
  const expositionApres = expositionCourte(s, h) - titresCourts(s, id, h) * c.prix + (titresCourts(s, id, h) + q) * c.prix * (1 - impact);
  return {
    titres: q, prixMoyen, produit, prixApres: c.prix * (1 - impact), capacite: capaciteDecouvert(s, h), disponible: pretable(s, c),
    fraisAnnuels: q * c.prix * TAUX_PRET_TITRES, dividendesAnnuels: q * 4 * (c.dernierDiv || 0), expositionApres,
  };
}
export function vendreADecouvert(s0, id, montant) {
  const s = cloner(s0);
  const c = societe(s, id);
  if (controlees(s).has(c.id)) throw new Error(`${c.nom} fait partie de votre groupe : parier contre elle serait un délit d'initié.`);
  const ap = apercuVenteDecouvert(s, id, montant);
  if (ap.titres > ap.disponible + 1e-9) throw new Error(`Les prêteurs n'ont plus que ${fmtTitres(ap.disponible)} ${c.nom} à prêter (${Math.round(100 * PART_PRETABLE)} % du flottant au plus).`);
  if (montant > ap.capacite + 1e-9) throw new Error(`Votre courtier limite vos ventes à découvert à votre fortune nette : ${ap.capacite.toFixed(1)} M€ de plus au plus.`);
  _ouvrir(s, JOUEUR, c, ap);
  journal(s, 'vente', `Vous vendez à découvert ${fmtTitres(ap.titres)} ${c.nom} à ${ap.prixMoyen.toFixed(2)} € (${ap.produit.toFixed(1)} M€) ; le cours passe à ${ap.prixApres.toFixed(2)} €.`, JOUEUR);
  return s;
}
function _ouvrir(s, h, c, ap) {
  const cp = compte(s, h);
  const p = cp.courtes?.[c.id];
  const titres = (p?.titres || 0) + ap.titres;
  const prixMoyen = ((p ? p.titres * p.prixMoyen : 0) + ap.titres * ap.prixMoyen) / titres;
  cp.courtes = { ...(cp.courtes || {}), [c.id]: { titres, prixMoyen } };
  crediter(s, h, ap.produit);
  c.prix = ap.prixApres;
}

// Rachat des titres pour les rendre au prêteur
export function apercuCouverture(s, id, titres, h = JOUEUR, prime = 0) {
  const c = societe(s, id);
  const q = Math.min(titres, titresCourts(s, id, h));
  if (!(q > 1e-9)) throw new Error(`Vous n'avez pas de position courte sur ${c.nom}.`);
  const impact = IMPACT * q / c.actions;
  const prixMoyen = c.prix * (1 + impact / 2) * (1 + prime);
  const cout = q * prixMoyen * (1 + COMMISSION);
  const p = positionsCourtes(s, h)[id];
  return { titres: q, prixMoyen, cout, prixApres: c.prix * (1 + impact), resultat: q * (p.prixMoyen - prixMoyen), reste: p.titres - q };
}
export function couvrir(s0, id, titres) {
  const s = cloner(s0);
  const c = societe(s, id);
  const ap = apercuCouverture(s, id, titres);
  debiter(s, JOUEUR, ap.cout);
  _fermer(s, JOUEUR, c, ap);
  journal(s, 'achat', `Vous couvrez ${fmtTitres(ap.titres)} ${c.nom} vendus à découvert, rachetés à ${ap.prixMoyen.toFixed(2)} € : ${ap.resultat >= 0 ? 'gain' : 'perte'} de ${Math.abs(ap.resultat).toFixed(1)} M€.`, JOUEUR);
  return s;
}
function _fermer(s, h, c, ap) {
  const cp = compte(s, h);
  if (ap.reste > 1e-9) cp.courtes[c.id] = { ...cp.courtes[c.id], titres: ap.reste };
  else { delete cp.courtes[c.id]; if (!Object.keys(cp.courtes).length) delete cp.courtes; }
  c.prix = ap.prixApres;
}
// Rachat imposé par le courtier ou le prêteur : prime, pas de contrôle de trésorerie (la marge absorbe)
export function _racheterForce(s, h, c, titres, motif) {
  const ap = apercuCouverture(s, c.id, titres, h, PRIME_RACHAT_FORCE);
  const cp = compte(s, h);
  cp.cash -= ap.cout;
  if (cp.cash < 0) { cp.marge += -cp.cash; cp.cash = 0; }
  _fermer(s, h, c, ap);
  journal(s, h === JOUEUR ? 'alerte' : 'concurrent', `${motif} : ${fmtTitres(ap.titres)} ${c.nom} rachetés d'office à ${ap.prixMoyen.toFixed(2)} € (${ap.resultat >= 0 ? 'gain' : 'perte'} de ${Math.abs(ap.resultat).toFixed(1)} M€).`, h);
}

// ---------- À LA CLÔTURE ----------
// Après la mise à jour des cours : frais de prêt et dividendes dus, rappels de titres, appels de couverture.
export function gererDecouverts(s) {
  for (const h of acteurs(s)) {
    const cp = compte(s, h);
    if (!cp.courtes || (h !== JOUEUR && !s.raiders[h].actif)) continue;
    let du = 0;
    for (const [id, p] of Object.entries(cp.courtes)) {
      const c = s.societes[id];
      if (!c?.active) continue;
      du += p.titres * c.prix * TAUX_PRET_TITRES / 4 + p.titres * (c.dernierDiv || 0);
    }
    cp.cash -= du;
    if (cp.cash < 0) { cp.marge += -cp.cash; cp.cash = 0; }
  }
  // Rappel des titres quand le flottant ne suffit plus à couvrir les prêts (après une OPA, par exemple)
  for (const c of actives(s)) {
    const total = totalCourt(s, c.id), limite = RAPPEL_FLOTTANT * (c.actionnaires.public || 0);
    if (total <= limite + 1e-9) continue;
    for (const h of acteurs(s)) {
      const q = titresCourts(s, c.id, h);
      if (q > 0) _racheterForce(s, h, c, q * (total - limite) / total, `Les prêteurs rappellent leurs titres ${c.nom}, le flottant s'étant réduit`);
    }
  }
  // Appel de couverture : l'exposition ne doit pas dépasser 1,5 fois la fortune nette
  for (const h of acteurs(s)) {
    if (h !== JOUEUR && !s.raiders[h].actif) continue;
    let iter = 0;
    while (compte(s, h).courtes && expositionCourte(s, h) > APPEL_DECOUVERT * Math.max(0, fortune(s, h)) + 1e-9 && iter++ < 20) {
      const [id, p] = Object.entries(compte(s, h).courtes).filter(([i]) => s.societes[i]?.active).sort((a, b) => b[1].titres * s.societes[b[0]].prix - a[1].titres * s.societes[a[0]].prix)[0] || [];
      if (!id) break;
      _racheterForce(s, h, s.societes[id], p.titres < 1e-4 ? p.titres : 0.5 * p.titres, h === JOUEUR ? 'Appel de couverture de votre courtier' : `Appel de couverture pour ${RAIDER_BY_ID[h].nom}`);
    }
  }
}
// Une société disparaît : liquidée, la dette de titres ne vaut plus rien ; absorbée, elle se convertit à la parité
export function solderDecouvertsFaillite(s, c) {
  for (const h of acteurs(s)) {
    const p = compte(s, h).courtes?.[c.id];
    if (!p) continue;
    delete compte(s, h).courtes[c.id];
    if (!Object.keys(compte(s, h).courtes).length) delete compte(s, h).courtes;
    if (h === JOUEUR) journal(s, 'vente', `La liquidation de ${c.nom} solde votre vente à découvert : ${fmtTitres(p.titres)} à ne jamais racheter, gain de ${(p.titres * p.prixMoyen).toFixed(1)} M€.`, JOUEUR);
  }
}
export function convertirDecouvertsFusion(s, a, b, ratio) {
  for (const h of acteurs(s)) {
    const cp = compte(s, h);
    const p = cp.courtes?.[b.id];
    if (!p) continue;
    delete cp.courtes[b.id];
    const q = p.titres * ratio, ancien = cp.courtes[a.id];
    const titres = (ancien?.titres || 0) + q;
    cp.courtes[a.id] = { titres, prixMoyen: ((ancien ? ancien.titres * ancien.prixMoyen : 0) + p.titres * p.prixMoyen) / titres };
  }
}
