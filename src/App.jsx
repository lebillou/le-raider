import React, { useState, useEffect, useRef } from 'react';
import { finTrimestre, nouvellePartie, prolonger } from './engine/index.js';
import { Bandeau } from './ui/Bandeau.jsx';
import { Bilan } from './ui/Bilan.jsx';
import { Concurrents } from './ui/Concurrents.jsx';
import { Cote } from './ui/Cote.jsx';
import { Creation } from './ui/Creation.jsx';
import { Fenetre } from './ui/Fenetre.jsx';
import { Journal } from './ui/Journal.jsx';
import { NouvellePartie } from './ui/NouvellePartie.jsx';
import { Portefeuille } from './ui/Portefeuille.jsx';
import { Societe } from './ui/Societe.jsx';
import { charger, sauver } from './sauvegarde.js';

export default function App({ initial = null, ongletInitial = 'cote', selectionInitiale = null }) {
  const [s, setS] = useState(() => initial || nouvellePartie());
  const [onglet, setOnglet] = useState(ongletInitial);
  const [sel, setSel] = useState(selectionInitiale);
  const [action, setAction] = useState(null);
  const [dialogue, setDialogue] = useState(false);
  const [creation, setCreation] = useState(false);
  const [large, setLarge] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 820 : true);
  const charge = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const f = () => setLarge(window.innerWidth > 820);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  useEffect(() => {
    if (initial) return;
    charger().then(p => { if (p && p.ordre && !charge.current) { charge.current = true; setS(p); } });
  }, []);
  useEffect(() => { if (s.tour > 0 || s.journal.length > 1) sauver(s); }, [s]);

  const choisir = (id) => { setSel(id); if (!large) setOnglet('societe'); };
  const fin = () => setS(finTrimestre(s));
  const nouvelle = () => setDialogue(true);
  const creer = (ans) => { const n = nouvellePartie(undefined, { nbTours: 4 * ans }); setS(n); sauver(n); setSel(null); setOnglet('cote'); setDialogue(false); };
  const prolongerPartie = () => { setS(prolonger(s, 10)); setOnglet('cote'); };
  useEffect(() => { if (s.fini) setOnglet('bilan'); }, [s.fini]);

  const bilan = <Bilan s={s} onNouvelle={nouvelle} onProlonger={prolongerPartie} onSel={choisir} />;
  const droite = onglet === 'bilan' ? bilan
    : onglet === 'portefeuille' ? <Portefeuille s={s} onSel={choisir} onCreer={() => setCreation(true)} />
    : onglet === 'journal' ? <Journal s={s} />
    : onglet === 'concurrents' ? <Concurrents s={s} onSel={choisir} />
    : <Societe s={s} id={sel} onAction={setAction} onSel={choisir} />;

  return (
    <div className="rd">
      <Bandeau s={s} onFin={fin} onNouvelle={nouvelle} />
      <nav className="nav">
        {[...(s.fini ? [['bilan', 'Bilan']] : []), ...(large ? [['cote', 'La cote'], ['portefeuille', 'Portefeuille'], ['concurrents', 'Concurrents'], ['journal', 'Journal']] : [['cote', 'La cote'], ['societe', 'Société'], ['portefeuille', 'Portefeuille'], ['concurrents', 'Concurrents'], ['journal', 'Journal']])].map(([id, l]) =>
          <button key={id} className={onglet === id ? 'actif' : ''} onClick={() => setOnglet(id)}>{l}</button>)}
      </nav>
      {onglet === 'bilan' ? (
        <div className="corps" style={{ gridTemplateColumns: '1fr' }}><div className="colonne" style={{ maxWidth: 980 }}>{bilan}</div></div>
      ) : large ? (
        <div className="corps">
          <div className="colonne">{onglet === 'cote' ? <Cote s={s} sel={sel} onSel={choisir} onCreer={() => setCreation(true)} /> : onglet === 'portefeuille' ? <Portefeuille s={s} onSel={choisir} onCreer={() => setCreation(true)} /> : onglet === 'concurrents' ? <Concurrents s={s} onSel={choisir} /> : <Journal s={s} />}</div>
          <div className="colonne"><Societe s={s} id={sel} onAction={setAction} onSel={choisir} /></div>
        </div>
      ) : (
        <div className="corps"><div className="colonne">{onglet === 'cote' ? <Cote s={s} sel={sel} onSel={choisir} onCreer={() => setCreation(true)} /> : droite}</div></div>
      )}
      {action && !s.fini && <Fenetre s={s} action={action} onFermer={() => setAction(null)} onValider={(n) => { setS(n); setAction(null); }} />}
      {dialogue && <NouvellePartie onFermer={() => setDialogue(false)} onCreer={creer} />}
      {creation && !s.fini && <Creation s={s} onFermer={() => setCreation(false)} onValider={(n) => { setS(n); setCreation(false); setSel(`F${n.nbFondees}`); if (!large) setOnglet('societe'); }} />}
    </div>
  );
}
