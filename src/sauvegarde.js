// Sauvegarde automatique de la partie en cours, dans le stockage local du navigateur
// (ou de la fenêtre de l'application Mac, qui dispose du même stockage).
// La clé change quand le format de l'état change : une ancienne sauvegarde est alors ignorée.
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
