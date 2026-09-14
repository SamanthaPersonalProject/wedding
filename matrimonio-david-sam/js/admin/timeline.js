/**
 * Pannello programma: le voci della giornata, in ordine.
 * L'ordine si cambia trascinando; viene salvato in un colpo solo.
 */

import { el, render, modal, confirmDialog, toast, formValues } from '../lib/dom.js';
import { formatTime } from '../lib/format.js';

export function createTimelinePanel(root, repo) {
  let items = [];

  const reload = async () => {
    items = await repo.listTimeline();
    draw();
  };

  /* ---------------- modale di modifica ---------------- */

  async function edit(item) {
    const isNew = !item;

    const form = el('form', { novalidate: true }, el('div', { class: 'stack stack--tight' }, [
      el('div', { class: 'field-row' }, [
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', for: 'pr-ora' }, 'Orario'),
          el('input', { class: 'input', id: 'pr-ora', name: 'time', type: 'time', required: true, value: item?.time || '' }),
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'check', for: 'pr-pub' }, [
            el('input', { type: 'checkbox', id: 'pr-pub', name: 'published', checked: item ? item.published : true }),
            el('span', {}, 'Visibile sul sito'),
          ]),
        ]),
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'pr-titolo' }, 'Titolo'),
        el('input', { class: 'input', id: 'pr-titolo', name: 'title', required: true, value: item?.title || '' }),
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'pr-desc' }, 'Descrizione'),
        el('textarea', { class: 'textarea', id: 'pr-desc', name: 'description' }, item?.description || ''),
      ]),
    ]));

    const result = await modal({
      title: isNew ? 'Nuova voce del programma' : 'Modifica voce',
      body: form,
      actions: (close) => [
        !isNew ? el('button', {
          class: 'btn btn--danger btn--sm', type: 'button',
          onClick: async () => {
            const sure = await confirmDialog('Eliminare la voce?', `“${item.title}” sparirà dal programma.`, 'Elimina');
            if (sure) close('delete');
          },
        }, 'Elimina') : null,
        el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => close(undefined) }, 'Annulla'),
        el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => close('save') }, 'Salva'),
      ],
    });

    if (result === 'delete') {
      await repo.deleteTimelineItem(item.id);
      toast('Voce eliminata.');
      await reload();
      return;
    }

    if (result !== 'save') return;

    const values = formValues(form);
    if (!values.time || !values.title) {
      toast('Servono orario e titolo.', 'danger');
      return;
    }

    try {
      await repo.saveTimelineItem({
        id: item?.id,
        time: values.time,
        title: values.title,
        description: values.description || '',
        published: 'published' in values,
        position: item?.position,
      });
      toast(isNew ? 'Voce aggiunta.' : 'Voce aggiornata.', 'ok');
      await reload();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  /* ---------------- trascinamento ---------------- */

  let draggedId = null;

  function rowNode(item) {
    const node = el('div', {
      class: 'sortable__item',
      draggable: true,
      dataset: { id: item.id },

      onDragstart: (event) => {
        draggedId = item.id;
        node.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.id);
      },
      onDragend: () => {
        draggedId = null;
        node.classList.remove('is-dragging');
      },
      onDragover: (event) => {
        event.preventDefault();
        if (draggedId && draggedId !== item.id) node.classList.add('is-over');
      },
      onDragleave: () => node.classList.remove('is-over'),
      onDrop: async (event) => {
        event.preventDefault();
        node.classList.remove('is-over');
        if (!draggedId || draggedId === item.id) return;

        const from = items.findIndex((entry) => entry.id === draggedId);
        const to = items.findIndex((entry) => entry.id === item.id);
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
        draw();

        try {
          await repo.reorderTimeline(items.map((entry) => entry.id));
        } catch (err) {
          toast(err.message, 'danger');
          await reload();
        }
      },
    }, [
      el('span', { class: 'sortable__grip', 'aria-hidden': 'true' }, '⠿'),
      el('span', { class: 'sortable__time' }, formatTime(item.time)),
      el('div', {}, [
        el('div', { class: 'sortable__title' }, [
          item.title,
          item.published ? null : el('span', { class: 'badge badge--wait', style: 'margin-left:var(--sp-2)' }, 'Nascosta'),
        ]),
        item.description ? el('div', { class: 'sortable__desc' }, item.description) : null,
      ]),
      el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => edit(item) }, 'Modifica'),
    ]);

    return node;
  }

  function draw() {
    render(root,
      el('div', { class: 'panel-head' }, [
        el('div', {}, [
          el('h2', {}, 'Programma'),
          el('p', {}, 'Trascina le righe per cambiare l’ordine. Le voci nascoste restano qui ma non compaiono sul sito.'),
        ]),
        el('div', { class: 'panel-actions' }, [
          el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => edit(null) }, 'Nuova voce'),
        ]),
      ]),
      el('div', { class: 'card' }, items.length
        ? items.map(rowNode)
        : el('div', { class: 'empty' }, [
            el('p', {}, 'Il programma è vuoto.'),
            el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => edit(null) }, 'Aggiungi la prima voce'),
          ])));
  }

  return { reload };
}
