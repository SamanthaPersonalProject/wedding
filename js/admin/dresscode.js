/**
 * Pannello dress code: le righe della lista che compare sul sito,
 * nella sezione del tartan. L'ordine si cambia trascinando.
 */

import { el, render, modal, confirmDialog, toast, formValues } from '../lib/dom.js';
import { createDragSort, moveToward, moveBy, moveButtons } from './sortable.js';

export function createDressCodePanel(root, repo) {
  let items = [];

  const reload = async () => {
    items = await repo.listDressCode();
    draw();
  };

  /* ---------------- modale di modifica ---------------- */

  async function edit(item) {
    const isNew = !item;

    const form = el('form', { novalidate: true }, el('div', { class: 'stack stack--tight' }, [
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'dc-testo' }, 'Testo della voce'),
        el('textarea', { class: 'textarea', id: 'dc-testo', name: 'text', required: true }, item?.text || ''),
        el('p', { class: 'field__hint' }, 'Una riga della lista: breve e diretta, come le altre.'),
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'check', for: 'dc-pub' }, [
          el('input', { type: 'checkbox', id: 'dc-pub', name: 'published', checked: item ? item.published : true }),
          el('span', {}, 'Visibile sul sito'),
        ]),
      ]),
    ]));

    const result = await modal({
      title: isNew ? 'Nuova voce del dress code' : 'Modifica voce',
      body: form,
      actions: (close) => [
        !isNew ? el('button', {
          class: 'btn btn--danger btn--sm', type: 'button',
          onClick: async () => {
            const sure = await confirmDialog('Eliminare la voce?', 'Sparirà dalla lista del dress code.', 'Elimina');
            if (sure) close('delete');
          },
        }, 'Elimina') : null,
        el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => close(undefined) }, 'Annulla'),
        el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => close('save') }, 'Salva'),
      ],
    });

    if (result === 'delete') {
      await repo.deleteDressCodeItem(item.id);
      toast('Voce eliminata.');
      await reload();
      return;
    }

    if (result !== 'save') return;

    const values = formValues(form);
    if (!values.text) {
      toast('Serve il testo della voce.', 'danger');
      return;
    }

    try {
      await repo.saveDressCodeItem({
        id: item?.id,
        text: values.text,
        published: 'published' in values,
        position: item?.position,
      });
      toast(isNew ? 'Voce aggiunta.' : 'Voce aggiornata.', 'ok');
      await reload();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  /* ---------------- ordine ---------------- */

  async function persistOrder(next) {
    items = next;
    draw();
    try {
      await repo.reorderDressCode(items.map((entry) => entry.id));
    } catch (err) {
      toast(err.message, 'danger');
      await reload();
    }
  }

  const dragAttrs = createDragSort((draggedId, targetId) =>
    persistOrder(moveToward(items, draggedId, targetId)));

  function rowNode(item, index) {
    return el('div', { class: 'sortable__item', ...dragAttrs(item.id) }, [
      el('span', { class: 'sortable__grip', 'aria-hidden': 'true' }, '⠿'),
      el('span', {}),
      el('div', {}, [
        el('div', { class: 'sortable__title' }, [
          item.text,
          item.published ? null : el('span', { class: 'badge badge--wait', style: 'margin-left:var(--sp-2)' }, 'Nascosta'),
        ]),
      ]),
      el('div', { class: 'table__actions' }, [
        moveButtons({
          index,
          total: items.length,
          label: 'la voce',
          onMove: (delta) => persistOrder(moveBy(items, item.id, delta)),
        }),
        el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => edit(item) }, 'Modifica'),
      ]),
    ]);
  }

  function draw() {
    render(root,
      el('div', { class: 'panel-head' }, [
        el('div', {}, [
          el('h2', {}, 'Dress code'),
          el('p', {}, 'La lista che compare sul sito sotto la sezione del tartan. Trascina le righe o usa le frecce per cambiare l’ordine.'),
        ]),
        el('div', { class: 'panel-actions' }, [
          el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => edit(null) }, 'Nuova voce'),
        ]),
      ]),
      el('div', { class: 'card' }, items.length
        ? items.map(rowNode)
        : el('div', { class: 'empty' }, [
            el('p', {}, 'Nessuna voce: sul sito resta il testo di riserva.'),
            el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => edit(null) }, 'Aggiungi la prima voce'),
          ])));
  }

  return { reload };
}
