import React, { useState } from 'react';
import { libelleTour } from '../engine/index.js';
import { exporterPartie, importerPartie } from '../sauvegarde.js';

// Exporter la partie (fichier ou presse-papiers) et en importer une autre (fichier ou texte collé)
export function Sauvegarde({ s, onFermer, onImporter }) {
  const [texte, setTexte] = useState('');
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);
  const nomFichier = `le-raider-${libelleTour(s.tour).replace(' ', '-')}.json`;
  const telecharger = () => {
    try {
      const url = URL.createObjectURL(new Blob([exporterPartie(s)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = nomFichier; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Partie exportée dans ${nomFichier} (dossier des téléchargements).`); setErreur(null);
    } catch (e) { setErreur("Le téléchargement n'est pas possible ici : copiez la sauvegarde à la place."); }
  };
  const copier = async () => {
    try { await navigator.clipboard.writeText(exporterPartie(s)); setMessage('Sauvegarde copiée : collez-la dans un fichier ou dans l\'autre version du jeu.'); setErreur(null); }
    catch (e) { setErreur('Le presse-papiers est inaccessible ici : utilisez le fichier.'); }
  };
  const charger = (contenu) => {
    try {
      const etat = importerPartie(contenu);
      if (!window.confirm(`Remplacer la partie en cours par celle-ci (${libelleTour(etat.tour)}) ?`)) return;
      onImporter(etat);
    } catch (e) { setErreur(e.message); setMessage(null); }
  };
  const lireFichier = (f) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => charger(r.result);
    r.onerror = () => setErreur('Lecture du fichier impossible.');
    r.readAsText(f);
  };
  return (
    <div className="voile" onClick={onFermer}>
      <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h3>Sauvegarde</h3>
        <div className="champ"><label>Exporter la partie en cours ({libelleTour(s.tour)})</label>
          <div className="actions" style={{ margin: 0 }}><button className="plein" onClick={telecharger}>Télécharger le fichier</button><button onClick={copier}>Copier</button></div>
        </div>
        <div className="champ"><label>Importer une partie</label>
          <input type="file" accept="application/json,.json" onChange={e => lireFichier(e.target.files?.[0])} aria-label="Fichier de sauvegarde" />
          <textarea value={texte} onChange={e => { setTexte(e.target.value); setErreur(null); }} placeholder="… ou collez ici une sauvegarde copiée" rows={3} style={{ width: '100%', marginTop: 8, fontFamily: 'var(--mono)', fontSize: 11 }} aria-label="Sauvegarde collée" />
          <div className="actions" style={{ margin: '6px 0 0' }}><button onClick={() => charger(texte)} disabled={!texte.trim()}>Charger ce texte</button></div>
        </div>
        <div className="aide">La partie est aussi sauvegardée automatiquement dans ce navigateur (ou dans l'application). Le fichier sert à la garder ailleurs, à la reprendre sur un autre appareil ou dans l'application de bureau.</div>
        {message && <div className="aide" style={{ color: 'var(--vert)' }}>{message}</div>}
        {erreur && <div className="erreur">{erreur}</div>}
        <div className="boutons"><button onClick={onFermer}>Fermer</button></div>
      </div>
    </div>
  );
}
