/** Punto d'ingresso della pagina pubblica. */

import { $, $$ } from '../lib/dom.js';
import { config } from '../config.js';
import { getRepository } from '../data/repository.js';
import { startCountdown } from './countdown.js';
import { renderTimeline, renderInfo, renderDressCode } from './public-content.js';
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
  const dressCodeRegion = $('[data-region="dresscode"]');
  const inviteRegion = $('[data-region="invite"]');

  try {
    const { timeline, info, dressCode } = await repo.getPublicContent();
    renderTimeline(timelineRegion, timeline);
    renderInfo(infoRegion, info);
    // Se il database non ha ancora il dress code (dressCode è null),
    // in pagina resta la lista statica.
    renderDressCode(dressCodeRegion, dressCode);
  } catch {
    renderTimeline(timelineRegion, []);
    renderInfo(infoRegion, []);
  }

  await createInviteGate(inviteRegion, repo).start();
}

boot();
