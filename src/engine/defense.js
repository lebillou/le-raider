// Offres hostiles sur vos sociétés tenues en contrôle relatif, et bons de défense.
import { capi, societe } from './acces.js';
import { JOUEUR, RAIDER_BY_ID } from './config.js';
import { journal } from './creation.js';
import { apercuOPA, lancerOPA } from './marche.js';
import { filiale } from './pilotage.js';
import { cloner } from './transactions.js';
import { libelleTour } from './trimestre.js';

// ---------- OFFRES HOSTILES ----------
// Une société que vous ne tenez qu'en contrôle relatif (moins de 50 % des votes) est attaquable : Lemarchand
// et Meridian peuvent y déposer une offre. Elle reste ouverte un trimestre et se dénoue à la clôture suivante,
// avant que les raiders ne rejouent : d'ici là, vous pouvez porter votre groupe à 50 % (OPA sur votre propre
// société, émission réservée), adopter des bons de défense, ou laisser faire. À la clôture, l'offre aboutit si
// elle donne encore le contrôle à son auteur et qu'il peut la payer ; sinon elle est retirée.
export const REPIT_HOSTILE = 4;            // trimestres sans nouvelle offre hostile après un dénouement
export const offreHostile = (s, cid) => (s.offresHostiles || []).find(o => o.cible === cid) || null;
export const attaquable = (s, c) => !c.defense && !offreHostile(s, c.id) && (c.derniereOffreHostile === undefined || s.tour - c.derniereOffreHostile >= REPIT_HOSTILE);

export function _deposerOffreHostile(s, rid, c, prime) {
  const o = { acteur: rid, cible: c.id, prixOffre: c.prix * (1 + prime), tour: s.tour };
  s.offresHostiles = [...(s.offresHostiles || []), o];
  journal(s, 'alerte', `${RAIDER_BY_ID[rid].nom} dépose une offre hostile sur ${c.nom} à ${o.prixOffre.toFixed(2)} € (+${Math.round(100 * prime)} %) : vous n'en avez que le contrôle relatif. Elle se dénouera à la prochaine clôture : portez votre groupe à 50 %, adoptez des bons de défense, ou laissez faire.`, rid);
}

// À la clôture, avant que les raiders ne jouent
export function traiterOffresHostiles(s) {
  const offres = s.offresHostiles || [];
  delete s.offresHostiles;
  for (const o of offres) {
    const c = s.societes[o.cible];
    if (!c?.active || !s.raiders[o.acteur]?.actif) continue;
    c.derniereOffreHostile = s.tour;
    const nom = RAIDER_BY_ID[o.acteur].nom;
    const retrait = (raison) => journal(s, 'opa', `${nom} retire son offre hostile sur ${c.nom} : ${raison}.`, o.acteur);
    if (c.defense) { retrait('les bons de défense la rendraient ruineuse'); continue; }
    const prime = o.prixOffre / c.prix - 1;
    if (!(prime > 0)) { retrait('le cours a dépassé le prix offert'); continue; }
    if (!apercuOPA(s, o.acteur, c.id, prime, 1, null, true).prendControle) { retrait('elle ne lui donnerait plus le contrôle'); continue; }
    try { Object.assign(s, lancerOPA(s, o.acteur, c.id, prime, 1, { sansSurenchere: true })); }
    catch (e) { retrait(e.message.replace(/\.$/, '').toLowerCase()); }
  }
}

// ---------- BONS DE DÉFENSE ----------
// Une « pilule empoisonnée » : en cas d'offre hostile, chaque actionnaire autre que l'assaillant pourrait
// souscrire des actions nouvelles à moitié prix, ce qui ruinerait l'offre. Les raiders s'en détournent et les
// offres déjà déposées sont retirées. Le marché n'aime pas les directions retranchées : tant que les bons sont
// en vigueur, le multiple de la société est décoté de 4 %. L'adoption coûte 0,3 % de la capitalisation.
export const DECOTE_BONS = 0.04;
export const FRAIS_BONS = 0.003;
export const facteurDefense = (c) => c.defense ? 1 - DECOTE_BONS : 1;
export function apercuBons(s, id) {
  const c = societe(s, id);
  return { frais: FRAIS_BONS * capi(c), decote: DECOTE_BONS, offre: offreHostile(s, id) };
}
export function adopterBons(s0, id) {
  const s = cloner(s0); const c = filiale(s, id);
  if (c.defense) throw new Error(`${c.nom} a déjà des bons de défense.`);
  const { frais } = apercuBons(s, id);
  if (frais > c.cash + 1e-9) throw new Error(`L'émission des bons coûte ${frais.toFixed(2)} M€ ; ${c.nom} n'a que ${c.cash.toFixed(1)} M€.`);
  c.cash -= frais;
  c.defense = { depuis: s.tour };
  journal(s, 'filiale', `${c.nom} adopte des bons de défense (${frais.toFixed(2)} M€) : toute offre hostile deviendrait ruineuse ; le marché décote le titre de ${Math.round(100 * DECOTE_BONS)} %.`, JOUEUR);
  return s;
}
export function retirerBons(s0, id) {
  const s = cloner(s0); const c = filiale(s, id);
  if (!c.defense) throw new Error(`${c.nom} n'a pas de bons de défense.`);
  const depuis = c.defense.depuis;
  delete c.defense;
  journal(s, 'filiale', `${c.nom} renonce à ses bons de défense, adoptés en ${libelleTour(depuis)} : la décote de gouvernance disparaît.`, JOUEUR);
  return s;
}
