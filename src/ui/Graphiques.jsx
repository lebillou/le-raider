import React from 'react';
import { JOUEUR, RAIDERS } from '../engine/index.js';
import { fM } from './format.js';

export function Spark({ hist, w = 64, h = 18 }) {
  if (!hist || hist.length < 2) return <svg className="spark" width={w} height={h} />;
  const min = Math.min(...hist), max = Math.max(...hist), n = hist.length;
  const pts = hist.map((v, i) => `${(i / (n - 1) * (w - 2) + 1).toFixed(1)},${(h - 1 - (max === min ? h / 2 : (v - min) / (max - min) * (h - 2))).toFixed(1)}`).join(' ');
  const up = hist[n - 1] >= hist[0];
  return <svg className="spark" width={w} height={h} aria-hidden="true"><polyline points={pts} fill="none" stroke={up ? 'var(--vert)' : 'var(--rouge)'} strokeWidth="1.2" /></svg>;
}

export const COULEURS = { J: 'var(--encre)', R1: '#7A6A2E', R2: '#A6301D', R3: '#3A5F8A' };

export function CourbeFortune({ series, nbTours, hauteur = 110 }) {
  const w = 600, h = hauteur;
  const tous = series.flatMap(x => x.hist);
  if (tous.length < 2) return null;
  const min = Math.min(0, ...tous), max = Math.max(...tous) * 1.05 || 1;
  const n = Math.max(nbTours, ...series.map(x => x.hist.length - 1));
  const x = (i) => i / n * (w - 10) + 5;
  const y = (v) => h - 12 - (v - min) / (max - min) * (h - 24);
  const depart = series[0].hist[0];   // votre capital de départ
  return (
    <svg className="fortune-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label="Courbes de fortune" style={{ height: h }}>
      <line x1={5} x2={w - 5} y1={y(depart)} y2={y(depart)} stroke="var(--regle)" strokeDasharray="3 3" />
      {min < 0 && <line x1={5} x2={w - 5} y1={y(0)} y2={y(0)} stroke="var(--rouge)" strokeWidth="0.8" />}
      {series.map(sr => <polyline key={sr.id} points={sr.hist.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" stroke={COULEURS[sr.id]} strokeWidth={sr.id === JOUEUR ? 1.8 : 1.1} />)}
      {series.length === 1 && <text x={w - 6} y={y(series[0].hist[series[0].hist.length - 1]) - 4} textAnchor="end" fontSize="12" fontFamily="var(--mono)" fill="var(--encre)">{fM(series[0].hist[series[0].hist.length - 1])}</text>}
    </svg>
  );
}

export const seriesFortune = (s) => [{ id: JOUEUR, nom: 'Vous', hist: s.joueur.histFortune }, ...RAIDERS.map(r => ({ id: r.id, nom: r.nom, hist: s.raiders[r.id].histFortune }))];
