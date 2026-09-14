/**
 * Pannello info utili: trasporto, alloggi e tutto il resto
 * che gli ospiti devono sapere prima di mettersi in viaggio.
 *
 * Le categorie sono testo libero, decise dagli sposi: il campo propone
 * quelle già usate ma non impedisce di scriverne una nuova.
 */

import { el, render, modal, confirmDialog, toast, formValues } from '../lib/dom.js';

const DEFAULT_CATEGORY = 'Buono a sapersi';

/** Le categorie già in uso, nell'ordine in cui compaiono. */
function usedCategories(items) {
  const seen = new Map();
  for (const item of items) {
    const name = item.category?.trim() || DEFAULT_CATEGORY;
    if (!seen.has(name)) seen.set(name, []);
    seen.get(name).push(item);
  }
  return seen;
}

export function createInfoPanel(root, repo) {
  let items = [];

  const reload = async () => {
    items = await repo.listInfo();
    draw();
  };

  /* ---------------- modale di modifica ---------------- */

  async function edit(item) {
    const isNew = !item;
    const known = [...usedCategories(items).keys()];

    const datalistId = 'categorie-note';
    const datalist = el('datalist', { id: datalistId },
      known.map((name) => el('option', { value: name })));

    const categoryInput = el('input', {
      class: 'input',
      id: 'info-categoria',
      name: 'category',
      list: datalistId,
      autocomplete: 'off',
      placeholder: DEFAULT_CATEGORY,
      value: item?.category || '',
    });

    const form = el('form', { novalidate: true }, el('div', { class: 'stack stack--tight' }, [
      el('div', { class: 'field-row' }, [
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', for: 'info-categoria' }, 'Categoria'),
          categoryInput,
          datalist,
          el('p', { class: 'field__hint' }, known.length
            ? `Scrivine una nuova o riusa: ${known.join(', ')}.`
            : 'Decidi tu come chiamarla: “Dove dormire”, “Trasporto”, “Per i bambini”…'),
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'check', for: 'info-pub' }, [
            el('input', { type: 'checkbox', id: 'info-pub', name: 'published', checked: item ? item.published : true }),
            el('span', {}, 'Visibile sul sito'),
          ]),
        ]),
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'info-titolo' }, 'Titolo'),
        el('input', { class: 'input', id: 'info-titolo', name: 'title', required: true, value: item?.title || '' }),
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'info-desc' }, 'Descrizione'),
        el('textarea', { class: 'textarea', id: 'info-desc', name: 'description' }, item?.description || ''),
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'info-url' }, 'Link (mappa, sito dell’hotel…)'),
        el('input', { class: 'input', id: 'info-url', name: 'url', type: 'url', value: item?.url || '', placeholder: 'https://' }),
      ]),
    ]));

    const result = await modal({
      title: isNew ? 'Nuova scheda informativa' : 'Modifica scheda',
      body: form,
      actions: (close) => [
        !isNew ? el('button', {
          class: 'btn btn--danger btn--sm', type: 'button',
          onClick: async () => {
            const sure = await confirmDialog('Eliminare la scheda?', `“${item.title}” sparirà dalle info utili.`, 'Elimina');
            if (sure) close('delete');
          },
        }, 'Elimina') : null,
        el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => close(undefined) }, 'Annulla'),
        el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => close('save') }, 'Salva'),
      ],
    });

    if (result === 'delete') {
      await repo.deleteInfoItem(item.id);
      toast('Scheda eliminata.');
      await reload();
      return;
    }

    if (result !== 'save') return;

    const values = formValues(form);
    if (!values.title) {
      toast('Serve almeno il titolo.', 'danger');
      return;
    }

    try {
      await repo.saveInfoItem({
        id: item?.id,
        category: values.category || DEFAULT_CATEGORY,
        title: values.title,
        description: values.description || '',
        url: values.url || '',
        published: 'published' in values,
        position: item?.position,
      });
      toast(isNew ? 'Scheda aggiunta.' : 'Scheda aggiornata.', 'ok');
      await reload();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  /** Rinomina una categoria su tutte le schede che la usano. */
  async function renameCategory(oldName, affected) {
    const input = el('input', { class: 'input', value: oldName, 'aria-label': 'Nuovo nome della categoria' });

    const confirmed = await modal({
      title: `Rinomina “${oldName}”`,
      body: el('div', { class: 'stack stack--tight' }, [
        el('p', { class: 'field__hint' }, `Il nuovo nome verrà applicato a ${affected.length === 1 ? 'una scheda' : `${affected.length} schede`}.`),
        input,
      ]),
      actions: (close) => [
        el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => close(false) }, 'Annulla'),
        el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => close(true) }, 'Rinomina'),
      ],
    });

    const next = input.value.trim();
    if (!confirmed || !next || next === oldName) return;

    try {
      for (const item of affected) {
        await repo.saveInfoItem({ ...item, category: next });
      }
      toast('Categoria rinominata.', 'ok');
      await reload();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  /* ---------------- disegno ---------------- */

  function cardNode(item) {
    return el('div', { class: 'sortable__item' }, [
      el('span', { class: 'sortable__grip', 'aria-hidden': 'true' }, '·'),
      el('span', {}),
      el('div', {}, [
        el('div', { class: 'sortable__title' }, [
          item.title,
          item.published ? null : el('span', { class: 'badge badge--wait', style: 'margin-left:var(--sp-2)' }, 'Nascosta'),
        ]),
        item.description ? el('div', { class: 'sortable__desc' }, item.description) : null,
        item.url ? el('a', { class: 'sortable__desc', href: item.url, target: '_blank', rel: 'noopener noreferrer' }, item.url) : null,
      ]),
      el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => edit(item) }, 'Modifica'),
    ]);
  }

  function draw() {
    const groups = usedCategories(items);

    render(root,
      el('div', { class: 'panel-head' }, [
        el('div', {}, [
          el('h2', {}, 'Info utili'),
          el('p', {}, 'Compaiono nella sezione “Info pratiche” del sito, raggruppate per categoria.'),
        ]),
        el('div', { class: 'panel-actions' }, [
          el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => edit(null) }, 'Nuova scheda'),
        ]),
      ]),

      items.length
        ? el('div', { class: 'stack' }, [...groups.entries()].map(([name, list]) =>
            el('div', { class: 'card' }, [
              el('div', { class: 'card__head' }, [
                el('h3', { class: 'card__title' }, name),
                el('div', { class: 'toolbar' }, [
                  el('span', { class: 'field__hint' }, `${list.length} ${list.length === 1 ? 'scheda' : 'schede'}`),
                  el('button', {
                    class: 'btn btn--quiet btn--sm', type: 'button',
                    onClick: () => renameCategory(name, list),
                  }, 'Rinomina categoria'),
                ]),
              ]),
              ...list.map(cardNode),
            ])))
        : el('div', { class: 'card' }, el('div', { class: 'empty' }, [
            el('p', {}, 'Nessuna informazione, ancora.'),
            el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => edit(null) }, 'Aggiungi la prima scheda'),
          ])));
  }

  return { reload };
}
