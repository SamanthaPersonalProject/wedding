/** Punto d'ingresso della pagina pubblica. */

import { $, $$ } from '../lib/dom.js';
import { config } from '../config.js';
import { getRepository } from '../data/repository.js';
import { startCountdown } from './countdown.js';
import { renderTimeline, renderInfo, renderDressCode, renderPlaylist } from './public-content.js';
import { applySectionOrder } from './sections.js';
import { renderGallery } from './gallery.js';
import { createInviteGate } from './invite-gate.js';
import { createTabs } from './tabs.js';

/** true se la sezione è pubblicata (o se il portale non ne sa nulla). */
const isPublished = (sections, key) =>
  !Array.isArray(sections) || sections.find((entry) => entry.key === key)?.published !== false;

async function boot() {
  startCountdown($('#countdown'), config.wedding.dateTime);

  // Prima dei dati: le schede sono contenuto statico e non devono
  // aspettare la rete per chiudersi.
  $$('[data-tabs]').forEach(createTabs);

  const repo = await getRepository();

  const timelineRegion = $('[data-region="timeline"]');
  const infoRegion = $('[data-region="info"]');
  const dressCodeRegion = $('[data-region="dresscode"]');
  const galleryRegion = $('[data-region="galleria"]');
  const playlistRegion = $('[data-region="playlist"]');
  const inviteRegion = $('[data-region="invite"]');

  try {
    const { timeline, info, dressCode, sections, gallery, settings } = await repo.getPublicContent();

    // L'ordine prima dei contenuti: le sezioni si spostano vuote, senza
    // far ballare la pagina sotto agli occhi di chi sta già leggendo.
    applySectionOrder(sections);

    renderTimeline(timelineRegion, timeline);
    renderInfo(infoRegion, info);
    // Se il database non ha ancora il dress code (dressCode è null),
    // in pagina resta la lista statica.
    renderDressCode(dressCodeRegion, dressCode);
    renderGallery(galleryRegion, gallery);
    renderPlaylist(playlistRegion, settings?.playlist_spotify, isPublished(sections, 'playlist'));
  } catch {
    renderTimeline(timelineRegion, []);
    renderInfo(infoRegion, []);
    // Senza dati la playlist non si può mostrare: la sezione resta
    // nascosta com'è nel markup.
    renderPlaylist(playlistRegion, '', false);
  }

  await createInviteGate(inviteRegion, repo).start();
}

boot();
