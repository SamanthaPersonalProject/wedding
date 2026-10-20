/**
 * Pannello galleria: le foto del piccolo slider nella sezione "La nostra
 * storia".
 *
 * Le immagini non si caricano da qui: nel database finisce il loro
 * indirizzo, non il file. Può essere un percorso dentro al sito
 * (`assets/img/noi.jpg`) o un link pubblico che apre direttamente
 * l'immagine.
 */

import { el, render, modal, confirmDialog, toast, formValues } from '../lib/dom.js';
import { createDragSort, moveToward, moveBy, moveButtons } from './sortable.js';

/**
 * Che tipo di indirizzo è stato scritto.
 *
 * Vanno bene entrambe le forme, e si possono mischiare: una foto dentro
 * al sito e la successiva su un servizio esterno.
 *
 * @returns {{tipo: 'locale'|'esterno'|'vuoto'|'errato', nota: string}}
 */
function classificaUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return { tipo: 'vuoto', nota: '' };

  if (/^https?:\/\//i.test(value)) {
    try {
      const { hostname } = new URL(value);
      return { tipo: 'esterno', nota: hostname };
    } catch {
      return { tipo: 'errato', nota: 'Indirizzo non valido.' };
    }
  }

  // Un indirizzo che comincia con "//" o con uno schema diverso da http
  // non è né un file del sito né un link utilizzabile.
  if (value.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return { tipo: 'errato', nota: 'Usa un percorso dentro al sito oppure un indirizzo che inizia per https://' };
  }

  return { tipo: 'locale', nota: value.replace(/^\.?\//, '') };
}

export function createGalleryPanel(root, repo) {
  let items = [];

  const reload = async () => {
    items = await repo.listGallery();
    draw();
  };

  /* ---------------- modale di modifica ---------------- */

  async function edit(item) {
    const isNew = !item;

    const preview = el('img', {
      class: 'thumb thumb--lg',
      alt: '',
      src: item?.url || '',
      hidden: !item?.url,
      onError: () => { preview.hidden = true; previewError.hidden = false; },
      onLoad: () => { preview.hidden = false; previewError.hidden = true; },
    });

    const previewError = el('p', { class: 'field__error', hidden: true },
      'Questo indirizzo non apre nessuna immagine. Controllalo: deve finire con .jpg, .png, .webp…');

    // Dice a colpo d'occhio se quello scritto è un file del sito o un
    // indirizzo esterno, e da quale servizio.
    const tipoRiga = el('p', { class: 'field__hint' });

    const aggiornaTipo = (value) => {
      const { tipo, nota } = classificaUrl(value);
      tipoRiga.classList.toggle('field__hint--warn', tipo === 'errato');
      tipoRiga.textContent = {
        vuoto:   '',
        locale:  `File dentro al sito: ${nota}`,
        esterno: `Indirizzo esterno, da ${nota}`,
        errato:  nota,
      }[tipo];
    };

    const urlInput = el('input', {
      class: 'input', id: 'foto-url', name: 'url', required: true,
      value: item?.url || '', placeholder: 'assets/img/noi.jpg  —  oppure  https://…',
      onInput: (event) => {
        const value = event.target.value.trim();
        previewError.hidden = true;
        preview.hidden = !value;
        if (value) preview.src = value;
        aggiornaTipo(value);
      },
    });

    aggiornaTipo(item?.url || '');

    const form = el('form', { novalidate: true }, el('div', { class: 'stack stack--tight' }, [
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'foto-url' }, 'Indirizzo dell’immagine'),
        urlInput,
        el('p', { class: 'field__hint' }, 'Due possibilità, e si possono mischiare: un file dentro al sito (assets/img/noi.jpg) oppure un link esterno che apre l’immagine da sola. In nessuno dei due casi il file viene caricato qui: resta dov’è.'),
        tipoRiga,
        previewError,
      ]),
      preview,
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'foto-didascalia' }, 'Didascalia'),
        el('input', { class: 'input', id: 'foto-didascalia', name: 'caption', value: item?.caption || '' }),
        el('p', { class: 'field__hint' }, 'Compare sotto la foto. Serve anche a chi naviga con lo screen reader: scrivi cosa si vede.'),
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'check', for: 'foto-pub' }, [
          el('input', { type: 'checkbox', id: 'foto-pub', name: 'published', checked: item ? item.published : true }),
          el('span', {}, 'Visibile sul sito'),
        ]),
      ]),
    ]));

    const result = await modal({
      title: isNew ? 'Nuova foto' : 'Modifica foto',
      body: form,
      actions: (close) => [
        !isNew ? el('button', {
          class: 'btn btn--danger btn--sm', type: 'button',
          onClick: async () => {
            const sure = await confirmDialog('Togliere la foto?',
              'Sparisce dallo slider. Il file resta dov’è: qui c’è solo il riferimento.', 'Togli');
            if (sure) close('delete');
          },
        }, 'Togli') : null,
        el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => close(undefined) }, 'Annulla'),
        el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => close('save') }, 'Salva'),
      ],
    });

    if (result === 'delete') {
      await repo.deleteGalleryItem(item.id);
      toast('Foto tolta dallo slider.');
      await reload();
      return;
    }

    if (result !== 'save') return;

    const values = formValues(form);
    if (!values.url) {
      toast('Serve l’indirizzo dell’immagine.', 'danger');
      return;
    }

    const { tipo, nota } = classificaUrl(values.url);
    if (tipo === 'errato') {
      toast(nota, 'danger');
      return;
    }

    try {
      await repo.saveGalleryItem({
        id: item?.id,
        url: values.url,
        caption: values.caption || '',
        published: 'published' in values,
        position: item?.position,
      });
      toast(isNew ? 'Foto aggiunta.' : 'Foto aggiornata.', 'ok');
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
      await repo.reorderGallery(items.map((entry) => entry.id));
    } catch (err) {
      toast(err.message, 'danger');
      await reload();
    }
  }

  const dragAttrs = createDragSort((draggedId, targetId) =>
    persistOrder(moveToward(items, draggedId, targetId)));

  /* ---------------- disegno ---------------- */

  function rowNode(item, index) {
    const thumb = el('img', {
      class: 'thumb', src: item.url, alt: '', loading: 'lazy',
      onError: (event) => event.target.replaceWith(el('span', { class: 'thumb thumb--broken', title: 'Immagine non raggiungibile' }, '⚠')),
    });

    return el('div', { class: 'sortable__item', ...dragAttrs(item.id) }, [
      el('span', { class: 'sortable__grip', 'aria-hidden': 'true' }, '⠿'),
      thumb,
      el('div', {}, [
        el('div', { class: 'sortable__title' }, [
          item.caption || 'Senza didascalia',
          item.published ? null : el('span', { class: 'badge badge--wait', style: 'margin-left:var(--sp-2)' }, 'Nascosta'),
        ]),
        el('div', { class: 'sortable__desc' }, [
          el('span', { class: 'badge badge--soft', style: 'margin-right:var(--sp-2)' },
            classificaUrl(item.url).tipo === 'esterno' ? 'esterna' : 'nel sito'),
          item.url,
        ]),
      ]),
      el('div', { class: 'table__actions' }, [
        moveButtons({
          index,
          total: items.length,
          label: item.caption || 'la foto',
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
          el('h2', {}, 'Galleria'),
          el('p', {}, 'Lo slider dentro “La nostra storia”. Qui si salva l’indirizzo delle foto, non il file: con una sola foto lo slider mostra quella e basta.'),
        ]),
        el('div', { class: 'panel-actions' }, [
          el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => edit(null) }, 'Nuova foto'),
        ]),
      ]),
      el('div', { class: 'card' }, items.length
        ? items.map(rowNode)
        : el('div', { class: 'empty' }, [
            el('p', {}, 'Nessuna foto: sul sito resta l’immagine fissa già in pagina.'),
            el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => edit(null) }, 'Aggiungi la prima foto'),
          ])));
  }

  return { reload };
}
