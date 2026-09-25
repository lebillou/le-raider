// Secteurs d'activité, holding, noms des sociétés.

// ---------- SECTEURS ----------
// mult : multiple VE/EBIT de référence ; g : croissance annuelle ; beta : sensibilité à la conjoncture
// marge : marge d'exploitation de référence ; vol : volatilité trimestrielle ; rot : CA / actifs
// effort : levier de marge propre au secteur (R&D ou marketing), budget habituel en part du CA
//   (déjà compris dans la marge de référence) et efficacité relative d'un euro dépensé au-delà
export const SECTEURS = [
  { id: 'energie',   nom: 'Énergie',        mult: 6,  g: 0.02,  beta: 1.2, marge: 0.12, vol: 0.10, rot: 0.6, effort: { nature: 'rd', norme: 0.015, efficacite: 0.6 } },
  { id: 'banque',    nom: 'Banque',         mult: 8,  g: 0.03,  beta: 1.0, marge: 0.20, vol: 0.09, rot: 0.3, effort: { nature: 'marketing', norme: 0.03, efficacite: 0.7 } },
  { id: 'distrib',   nom: 'Distribution',   mult: 8,  g: 0.025, beta: 0.6, marge: 0.04, vol: 0.06, rot: 2.5, effort: { nature: 'marketing', norme: 0.02, efficacite: 1.0 } },
  { id: 'industrie', nom: 'Industrie',      mult: 7,  g: 0.02,  beta: 1.4, marge: 0.08, vol: 0.09, rot: 1.2, effort: { nature: 'rd', norme: 0.03, efficacite: 0.9 } },
  { id: 'techno',    nom: 'Technologie',    mult: 16, g: 0.08,  beta: 1.1, marge: 0.14, vol: 0.14, rot: 1.5, effort: { nature: 'rd', norme: 0.12, efficacite: 1.3 } },
  { id: 'sante',     nom: 'Santé',          mult: 13, g: 0.05,  beta: 0.4, marge: 0.15, vol: 0.07, rot: 1.0, effort: { nature: 'rd', norme: 0.1, efficacite: 1.2 } },
  { id: 'immo',      nom: 'Immobilier',     mult: 12, g: 0.02,  beta: 0.8, marge: 0.35, vol: 0.07, rot: 0.15, effort: { nature: 'marketing', norme: 0.005, efficacite: 0.5 } },
  { id: 'transport', nom: 'Transport',      mult: 6,  g: 0.02,  beta: 1.5, marge: 0.06, vol: 0.10, rot: 0.8, effort: { nature: 'marketing', norme: 0.015, efficacite: 0.7 } },
  { id: 'agro',      nom: 'Agroalimentaire',mult: 9,  g: 0.02,  beta: 0.3, marge: 0.07, vol: 0.05, rot: 1.4, effort: { nature: 'marketing', norme: 0.05, efficacite: 1.0 } },
  { id: 'medias',    nom: 'Médias & luxe',  mult: 12, g: 0.04,  beta: 0.9, marge: 0.12, vol: 0.10, rot: 1.0, effort: { nature: 'marketing', norme: 0.08, efficacite: 1.3 } },
];
// La holding n'a pas d'exploitation : elle vaut son actif net, décoté par le marché
export const HOLDING = { id: 'holding', nom: 'Holding', mult: 0, g: 0, beta: 0.5, marge: 0, vol: 0.06, rot: 0 };
export const DECOTE_HOLDING = 0.10;
export const SECT_BY_ID = Object.fromEntries([...SECTEURS, HOLDING].map(x => [x.id, x]));
export const estHolding = (c) => c.secteur === 'holding';

export const NOMS = {
  energie:   ['Pétrolia', 'Gazeo', 'Hydralis', 'Solarex', 'Ventia'],
  banque:    ['Banque Sérénac', 'Crédit Atlantique', 'Mutuelles Réunies', 'Fidélia', 'Bancorp Lyonnais'],
  distrib:   ['Grands Magasins Réunis', 'Superco', 'Marché Frais', 'Distrimax', 'La Halle Moderne'],
  industrie: ['Forges de Lorraine', 'Mécanic Centre', 'Aciéries du Rhône', 'Turbines Réunies', 'Chaudronnerie Nationale'],
  techno:    ['Logiciels Ardent', 'Silicium Sud', 'Nexalys', 'Datalune', 'Cortex Systèmes'],
  sante:     ['Laboratoires Vesper', 'Cliniques Saint-Gilles', 'Pharmatek', 'Bioseine', 'Prothèses de l\'Ouest'],
  immo:      ['Foncière des Quais', 'Immo Sud-Ouest', 'Promotions Aquitaines', 'Bureaux de Paris', 'Gérance Nationale'],
  transport: ['Compagnie des Ferries', 'Aérolignes Régionales', 'Fret Express', 'Autocars Maréchal', 'Ports de l\'Ouest'],
  agro:      ['Biscuiterie Lorient', 'Conserves du Béarn', 'Laiterie Générale', 'Brasseries Réunies', 'Salaisons Basques'],
  medias:    ['Éditions du Phare', 'Radio-Télé Nationale', 'Maison Aubérac', 'Parfums Delcourt', 'Studios Lumière'],
};
