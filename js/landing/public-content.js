import { el, render } from '../lib/dom.js';
import { formatTime } from '../lib/format.js';

const DEFAULT_CATEGORY = 'Buono a sapersi';

/** Programma della giornata. */
export function renderTimeline(container, items) {
  container.removeAttribute('aria-busy');

  if (!items.length) {
    render(container, el('li', { class: 'schedule__item' }, [
      el('span', { class: 'schedule__time' }, '—'),
      el('div', { class: 'schedule__body' }, 'Il programma arriva a breve.'),
    ]));
    return;
  }

  render(container, items.map((item) => el('li', { class: 'schedule__item' }, [
    el('time', { class: 'schedule__time', datetime: item.time }, formatTime(item.time)),
    el('h3', { class: 'symbols__name' }, item.title),
    item.description ? el('p', { class: 'schedule__body' }, item.description) : null,
  ])));
}

/**
 * Informazioni pratiche, raggruppate per categoria.
 * Le categorie arrivano dai dati: le decide chi scrive le schede.
 */
export function renderInfo(container, items) {
  container.removeAttribute('aria-busy');

  if (!items.length) {
    render(container, el('div', { class: 'info-grid' },
      el('div', { class: 'info-card' }, el('p', {}, 'Stiamo ancora mettendo insieme le informazioni pratiche.'))));
    return;
  }

  const groups = new Map();
  for (const item of items) {
    const name = item.category?.trim() || DEFAULT_CATEGORY;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  }

  render(container, [...groups.entries()].map(([name, list]) =>
    el('div', { class: 'info-group' }, [
      el('h3', { class: 'info-group__title' }, name),
      el('div', { class: 'info-grid' }, list.map((item) => el('div', { class: 'info-card' }, [
        el('h4', { class: 'info-card__title' }, item.title),
        item.description ? el('p', {}, item.description) : null,
        item.url ? el('a', { href: item.url, rel: 'noopener noreferrer', target: '_blank' }, 'Apri il link') : null,
      ]))),
    ])));
}
