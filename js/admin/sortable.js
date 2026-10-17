/**
 * Riordino delle liste del portale: trascinamento e frecce.
 *
 * Il trascinamento HTML5 non esiste sui touch: su telefono e tablet le
 * frecce su/giù sono l'unico modo di spostare una riga. Ci sono entrambi,
 * e passano tutti e due per la stessa funzione di spostamento.
 */

import { el } from '../lib/dom.js';

/** L'elenco con l'elemento `id` spostato dove sta `targetId`. */
export function moveToward(list, id, targetId, key = 'id') {
  const from = list.findIndex((entry) => entry[key] === id);
  const to = list.findIndex((entry) => entry[key] === targetId);
  if (from < 0 || to < 0 || from === to) return list;

  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** L'elenco con l'elemento `id` spostato di `delta` posizioni. */
export function moveBy(list, id, delta, key = 'id') {
  const from = list.findIndex((entry) => entry[key] === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return list;

  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Crea gli attributi di trascinamento per le righe di una lista.
 * @param {(draggedId: string, targetId: string) => void} onMove
 * @returns {(id: string) => Object} attributi da passare a `el`
 */
export function createDragSort(onMove) {
  let draggedId = null;

  return (id) => ({
    draggable: true,
    dataset: { id },

    onDragstart: (event) => {
      draggedId = id;
      event.currentTarget.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(id));
    },
    onDragend: (event) => {
      draggedId = null;
      event.currentTarget.classList.remove('is-dragging');
    },
    onDragover: (event) => {
      event.preventDefault();
      if (draggedId !== null && draggedId !== id) event.currentTarget.classList.add('is-over');
    },
    onDragleave: (event) => event.currentTarget.classList.remove('is-over'),
    onDrop: (event) => {
      event.preventDefault();
      event.currentTarget.classList.remove('is-over');
      if (draggedId === null || draggedId === id) return;
      onMove(draggedId, id);
    },
  });
}

/**
 * Le due frecce su/giù per una riga.
 * @param {{index: number, total: number, label: string,
 *          onMove: (delta: number) => void}} options
 */
export function moveButtons({ index, total, label, onMove }) {
  const arrow = (delta, symbol, verb) => el('button', {
    class: 'btn btn--quiet btn--sm btn--icon',
    type: 'button',
    disabled: delta < 0 ? index === 0 : index === total - 1,
    title: `Sposta ${verb}`,
    'aria-label': `Sposta ${label} ${verb}`,
    onClick: () => onMove(delta),
  }, symbol);

  return el('div', { class: 'move-arrows' }, [
    arrow(-1, '↑', 'su'),
    arrow(1, '↓', 'giù'),
  ]);
}
