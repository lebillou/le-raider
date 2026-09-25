export const nf = (d) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fM = (v) => {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1000) return nf(2).format(v / 1000) + ' Md€';
  if (a >= 100) return nf(0).format(v) + ' M€';
  return nf(1).format(v) + ' M€';
};
// Montants fins (rémunérations) : deux décimales sous 10 M€

export const fMp = (v) => (v === null || v === undefined || !isFinite(v)) ? '—' : Math.abs(v) < 10 ? nf(2).format(v) + ' M€' : fM(v);

export const fE = (v) => nf(2).format(v) + ' €';

export const fP = (v, d = 0) => nf(d).format(100 * v) + ' %';

export const fT = (t) => t >= 1 ? nf(2).format(t) + ' M' : nf(0).format(t * 1000) + ' k';

export const classeVar = (v) => v > 0.0005 ? 'hausse' : v < -0.0005 ? 'baisse' : '';

export const signe = (v, d = 1) => (v > 0 ? '+' : '') + nf(d).format(100 * v) + ' %';
