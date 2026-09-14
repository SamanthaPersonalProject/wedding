/**
 * Schede.
 *
 * Progressive enhancement: nel markup i pannelli NON hanno `hidden`, li
 * nasconde questo modulo. Se il JS non parte, restano tutti aperti e il
 * contenuto si legge lo stesso — per una pagina di contenuti è meglio
 * che una sezione vuota.
 *
 * Tastiera come da pratica ARIA: frecce per cambiare scheda, Home/End
 * per gli estremi, e un solo tab nel flusso di tabulazione (roving
 * tabindex), così chi naviga da tastiera non deve attraversarle tutte.
 */

import { $, $$ } from '../lib/dom.js';

export function createTabs(root) {
  const tabs = $$('[role="tab"]', root);
  if (tabs.length < 2) return;

  const list = $('[role="tablist"]', root);
  const panelOf = (tab) => $(`#${tab.getAttribute('aria-controls')}`, root);

  /**
   * Quando le schede non ci stanno in riga la striscia scorre, e senza
   * un segno non si capisce. Le sfumature laterali dicono da che parte
   * c'è altro: una classe per lato, così spariscono agli estremi.
   */
  function syncEdges() {
    const rest = list.scrollWidth - list.clientWidth;
    list.classList.toggle('tabs__list--more-left', list.scrollLeft > 1);
    list.classList.toggle('tabs__list--more-right', list.scrollLeft < rest - 1);
  }

  /**
   * Porta la scheda dentro la striscia. Muove solo lo scorrimento
   * orizzontale della lista: scrollIntoView() trascinerebbe anche la
   * pagina, e chi clicca una scheda non si aspetta di essere spostato.
   */
  function keepVisible(tab) {
    const margin = 16;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;

    if (left < list.scrollLeft) {
      list.scrollLeft = left - margin;
    } else if (right > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = right - list.clientWidth + margin;
    }
  }

  function select(tab, { focus = false } = {}) {
    for (const other of tabs) {
      const active = other === tab;
      other.setAttribute('aria-selected', String(active));
      other.tabIndex = active ? 0 : -1;

      const panel = panelOf(other);
      if (panel) panel.hidden = !active;
    }
    keepVisible(tab);
    syncEdges();
    if (focus) tab.focus();
  }

  root.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab);
  });

  root.addEventListener('keydown', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab) return;

    const here = tabs.indexOf(tab);
    const there = {
      ArrowRight: here + 1,
      ArrowLeft: here - 1,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];

    if (there === undefined) return;
    event.preventDefault();
    select(tabs[(there + tabs.length) % tabs.length], { focus: true });
  });

  list.addEventListener('scroll', syncEdges, { passive: true });
  window.addEventListener('resize', syncEdges);

  // Un link a #pan-scozia apre la scheda giusta invece di lasciare la prima.
  const linked = tabs.find((tab) => `#${tab.getAttribute('aria-controls')}` === window.location.hash);
  select(linked || tabs[0]);
}
