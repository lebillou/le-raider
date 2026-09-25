// Aléa déterministe (mulberry32, gaussienne) : une graine = une partie reproductible.
// ---------- ALÉA DÉTERMINISTE ----------
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// gaussienne par Box-Muller
export const gauss = (r) => {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
// L'état porte un compteur ; on dérive un générateur frais à chaque appel.
export function rngDe(s) {
  s.graine = (s.graine + 1) | 0;
  return mulberry32(s.graine * 2654435761 + s.tour * 97);
}
