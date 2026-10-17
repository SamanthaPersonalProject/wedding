/**
 * Pannello sezioni: l'ordine dei blocchi della pagina pubblica.
 *
 * Qui non si creano né si eliminano sezioni — quelle stanno nel markup di
 * index.html. Si decide soltanto in che ordine compaiono e quali far
 * vedere: la pagina, al caricamento, si risistema di conseguenza.
 */

import { el, render, toast } from '../lib/dom.js';
import { createDragSort, moveToward, moveBy, moveButtons } from './sortable.js';

export function createSectionsPanel(root, repo) {
  let items = [];

  const reload = async () => {
    items = await repo.listSections();
    draw();
  };

  /** Salva l'ordine mostrato a schermo; se fallisce rilegge dal database. */
  async function persistOrder(next) {
    items = next;
    draw();
    try {
      await repo.reorderSections(items.map((entry) => entry.key));
    } catch (err) {
      toast(err.message, 'danger');
      await reload();
    }
  }

  const dragAttrs = createDragSort((draggedKey, targetKey) =>
    persistOrder(moveToward(items, draggedKey, targetKey, 'key')));

  async function toggle(section) {
    try {
      await repo.saveSection({ key: section.key, published: !section.published });
      toast(section.published ? 'Sezione nascosta.' : 'Sezione visibile.', 'ok');
      await reload();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  function rowNode(section, index) {
    return el('div', { class: 'sortable__item', ...dragAttrs(section.key) }, [
      el('span', { class: 'sortable__grip', 'aria-hidden': 'true' }, '⠿'),
      el('span', { class: 'sortable__time' }, String(index + 1)),
      el('div', {}, [
        el('div', { class: 'sortable__title' }, [
          section.label,
          section.published ? null : el('span', { class: 'badge badge--wait', style: 'margin-left:var(--sp-2)' }, 'Nascosta'),
        ]),
        el('div', { class: 'sortable__desc' }, `#${section.key}`),
      ]),
      el('div', { class: 'table__actions' }, [
        moveButtons({
          index,
          total: items.length,
          label: section.label,
          onMove: (delta) => persistOrder(moveBy(items, section.key, delta, 'key')),
        }),
        el('button', {
          class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => toggle(section),
        }, section.published ? 'Nascondi' : 'Mostra'),
      ]),
    ]);
  }

  function draw() {
    render(root,
      el('div', { class: 'panel-head' }, [
        el('div', {}, [
          el('h2', {}, 'Sezioni del sito'),
          el('p', {}, 'L’ordine in cui compaiono scorrendo la pagina. Trascina le righe o usa le frecce; una sezione nascosta sparisce dal sito ma resta qui.'),
        ]),
      ]),
      el('div', { class: 'card' }, items.length
        ? items.map(rowNode)
        : el('div', { class: 'empty' }, el('p', {},
            'Nessuna sezione registrata: esegui supabase/schema.sql aggiornato nel SQL Editor.'))));
  }

  return { reload };
}
