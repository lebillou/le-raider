// Des centaines d'ordres au hasard, toutes fonctions confondues : les comptes doivent rester justes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { m, J, verifier } from './outils.mjs';

test('40 parties jouées au hasard respectent les invariants comptables', () => {
  const rnd = m.mulberry32(7), pick = (a) => a[Math.floor(rnd() * a.length)];
  let executes = 0;
  for (let g = 100; g < 140; g++) {
    let s = m.nouvellePartie(g);
    for (let t = 0; t < 60 && !s.fini; t++) {
      for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) {
        const ctrl = m.controlees(s), acteurs = [J, ...ctrl], acteur = pick(acteurs), cible = pick(m.actives(s)), f = Math.max(1, m.fortune(s)), x = rnd();
        try {
          if (x < 0.25) s = m.acheter(s, acteur, cible.id, Math.max(0.5, f * (0.05 + 0.4 * rnd())));
          else if (x < 0.35) { const pos = m.actives(s).filter(c => c.actionnaires[acteur] > 0); if (pos.length) { const c = pick(pos); s = m.vendre(s, acteur, c.id, c.actionnaires[acteur] * rnd()); } }
          else if (x < 0.5) s = m.lancerOPA(s, pick(acteurs), cible.id, rnd() * 0.6, rnd() < 0.6 ? 1 : rnd());
          else if (x < 0.55) {
            // Création, avec parfois des titres ou une branche d'activité apportés en nature
            const type = rnd() < 0.5 ? 'holding' : 'operationnelle', fondateur = pick(acteurs), titres = {};
            const pos = m.actives(s).filter(c => c.actionnaires[fondateur] > 0);
            if (pos.length && rnd() < 0.4) { const c = pick(pos); titres[c.id] = c.actionnaires[fondateur] * (rnd() < 0.3 ? 1 : rnd()); }
            const branche = fondateur !== J && rnd() < 0.3 ? rnd() * 0.55 : 0;
            s = m.creerSociete(s, fondateur, { type, secteur: pick(m.SECTEURS).id, nom: `Test ${g}-${t}-${k}`, capital: (type === 'holding' ? 2 : 5) * rnd() + rnd() * f * 0.5, titres, branche });
          }
          else if (ctrl.size) {
            const fid = pick([...ctrl]), c = s.societes[fid], y = rnd();
            if (y < 0.15) s = m.emprunter(s, fid, m.capaciteEmprunt(c, s) * rnd());
            else if (y < 0.25) s = m.rembourser(s, fid, c.cash * rnd());
            else if (y < 0.35) s = m.dividendeExceptionnel(s, fid, c.cash * rnd());
            else if (y < 0.42) s = m.racheterActions(s, fid, c.cash * rnd());
            else if (y < 0.52) s = m.investir(s, fid, c.cash * rnd());
            else if (y < 0.58) s = m.cederActifs(s, fid, c.actifs * 0.3 * rnd());
            else if (y < 0.64) s = rnd() < 0.5 ? m.restructurer(s, fid) : m.fixerDividende(s, fid, rnd() * 0.8);
            else if (y < 0.74) { if (rnd() < 0.75) { const type = pick(['classique', 'hy', 'convertible']); s = m.emettreObligations(s, fid, { montant: 1 + rnd() * m.capaciteObligataire(s, c, type), maturite: pick(m.MATURITES), type }); } else if (c.obligations?.length) s = m.rembourserObligation(s, fid, pick(c.obligations).id); }
            else if (y < 0.82) { if (rnd() < 0.8) s = m.prendreMandat(s, fid); else { const mm = m.mandatsDe(s, J); if (mm.length) s = m.quitterMandat(s, mm[0].id); } }
            else if (y < 0.92) { const mode = pick(['public', 'droits', 'prive', 'reservee']); s = m.emettreActions(s, fid, { montant: 1 + rnd() * m.montantMaxEmission(c, mode) * (mode === 'reservee' ? 0.2 : 0.9), mode, souscrireJoueur: rnd() < 0.5, investisseur: pick(m.RAIDERS).id, souscripteur: pick(acteurs) }); }
            else if (y < 0.96) s = rnd() < 0.6 ? m.apporterCompteCourant(s, fid, 0.5 + rnd() * f * 0.2) : m.rembourserCompteCourant(s, fid, rnd() * 5);
            else { const cand = [...ctrl].filter(id => id !== fid); if (cand.length) s = m.fusionner(s, fid, pick(cand)); }
          }
          executes++;
        } catch (e) {
          // Les refus sont normaux (trésorerie, plafonds...), pas les erreurs de programmation
          assert.ok(!(e instanceof TypeError || e instanceof ReferenceError || e instanceof RangeError), `erreur de programmation : ${e.stack}`);
        }
        verifier(s, `graine ${g} trimestre ${t}`);
      }
      s = m.finTrimestre(s);
      verifier(s, `graine ${g} clôture ${t}`);
    }
  }
  assert.ok(executes > 1500, `trop peu d'ordres exécutés (${executes})`);
});
