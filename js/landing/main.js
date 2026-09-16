/** Punto d'ingresso della pagina pubblica. */

import { $, $$ } from '../lib/dom.js';
import { config } from '../config.js';
import { getRepository } from '../data/repository.js';
import { startCountdown } from './countdown.js';
import { renderTimeline, renderInfo } from './public-content.js';
import { createInviteGate } from './invite-gate.js';
import { createTabs } from './tabs.js';

async function boot() {
  startCountdown($('#countdown'), config.wedding.dateTime);

  // Prima dei dati: le schede sono contenuto statico e non devono
  // aspettare la rete per chiudersi.
  $$('[data-tabs]').forEach(createTabs);

  const repo = await getRepository();

  const timelineRegion = $('[data-region="timeline"]');
  const infoRegion = $('[data-region="info"]');
  const inviteRegion = $('[data-region="invite"]');

  try {
    const { timeline, info } = await repo.getPublicContent();
    renderTimeline(timelineRegion, timeline);
    renderInfo(infoRegion, info);
  } catch {
    renderTimeline(timelineRegion, []);
    renderInfo(infoRegion, []);
  }

  await createInviteGate(inviteRegion, repo).start();
}

boot();
