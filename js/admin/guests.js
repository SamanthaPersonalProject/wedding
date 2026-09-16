/**
 * Pannello invitati: gruppi, codici, ospiti e stato delle risposte.
 * Un "invito" è un gruppo (una famiglia, una coppia) con un codice solo.
 */

import { $, el, render, modal, confirmDialog, toast, formValues } from '../lib/dom.js';
import { generateInviteCode, plural } from '../lib/format.js';
import { openWhatsApp, inviteLink } from './whatsapp.js';

const STATUS_META = {
  confermato: { label: 'Confermato', className: 'badge--ok' },
  in_attesa:  { label: 'In attesa',  className: 'badge--wait' },
  assente:    { label: 'Non viene',  className: 'badge--absent' },
};

/** Stato complessivo di un gruppo, ricavato dai suoi ospiti. */
function inviteStatus(invite) {
  if (!invite.guests.length) return 'in_attesa';
  if (invite.guests.some((guest) => guest.status === 'in_attesa')) return 'in_attesa';
  if (invite.guests.every((guest) => guest.status === 'assente')) return 'assente';
  return 'confermato';
}

export function createGuestsPanel(root, repo) {
  let invites = [];
  let search = '';
  let filter = 'tutti';

  const reload = async () => {
    invites = await repo.listInvites();
    draw();
  };

  /* ---------------- riepilogo ---------------- */

  function statsNode() {
    const guests = invites.flatMap((invite) => invite.guests);
    const confirmed = guests.filter((guest) => guest.status === 'confermato');
    const waiting = guests.filter((guest) => guest.status === 'in_attesa');
    const absent = guests.filter((guest) => guest.status === 'assente');
    const transport = invites.filter((invite) => invite.needsTransport).length;

    const stat = (value, label, variant = '') =>
      el('div', { class: `stat ${variant}` }, [
        el('span', { class: 'stat__value' }, String(value)),
        el('span', { class: 'stat__label' }, label),
      ]);

    return el('div', { class: 'stats' }, [
      stat(invites.length, 'gruppi invitati'),
      stat(confirmed.length, 'confermati', 'stat--ok'),
      stat(waiting.length, 'in attesa', 'stat--wait'),
      stat(absent.length, 'non vengono', 'stat--absent'),
      stat(transport, 'chiedono la navetta'),
    ]);
  }

  /* ---------------- tabella ---------------- */

  function visibleInvites() {
    const needle = search.toLowerCase();
    return invites.filter((invite) => {
      const matchesText = !needle
        || invite.groupName.toLowerCase().includes(needle)
        || invite.code.toLowerCase().includes(needle)
        || invite.guests.some((guest) => guest.name.toLowerCase().includes(needle));
      const matchesFilter = filter === 'tutti' || inviteStatus(invite) === filter;
      return matchesText && matchesFilter;
    });
  }

  function rowNode(invite) {
    const status = inviteStatus(invite);
    const meta = STATUS_META[status];
    const confirmed = invite.guests.filter((guest) => guest.status === 'confermato').length;

    return el('tr', {}, [
      el('td', {}, [
        el('div', { style: 'font-weight:500' }, invite.groupName),
        invite.adminNote ? el('div', { style: 'color:var(--t-on-light-mute)' }, invite.adminNote) : null,
      ]),
      el('td', {}, el('span', { class: 'code-chip' }, invite.code)),
      el('td', {}, el('span', { class: `badge ${meta.className}` }, meta.label)),
      el('td', { class: 'num' }, `${confirmed}/${invite.guests.length}`),
      el('td', {}, invite.needsTransport ? 'Navetta' : '—'),
      el('td', {}, el('div', { class: 'table__actions' }, [
        el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => editGuests(invite) }, 'Ospiti'),
        el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => editInvite(invite) }, 'Modifica'),
        el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => copyLink(invite) }, 'Link'),
        el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => openWhatsApp(invite) }, 'WhatsApp'),
      ])),
    ]);
  }

  function tableNode() {
    const rows = visibleInvites();

    if (!invites.length) {
      return el('div', { class: 'empty' }, [
        el('p', {}, 'Nessun invitato, ancora.'),
        el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => editInvite(null) }, 'Aggiungi il primo gruppo'),
      ]);
    }

    if (!rows.length) {
      return el('div', { class: 'empty' }, el('p', {}, 'Nessun gruppo corrisponde alla ricerca.'));
    }

    return el('div', { class: 'table-scroll' }, el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, 'Gruppo'),
        el('th', {}, 'Codice'),
        el('th', {}, 'Stato'),
        el('th', { class: 'num' }, 'Conf.'),
        el('th', {}, 'Trasporto'),
        el('th', {}, ''),
      ])),
      el('tbody', {}, rows.map(rowNode)),
    ]));
  }

  /* ---------------- azioni ---------------- */

  async function copyLink(invite) {
    await navigator.clipboard.writeText(inviteLink(invite));
    toast('Link invito copiato.', 'ok');
  }

  async function editInvite(invite) {
    const isNew = !invite;
    const codeInput = el('input', {
      class: 'input', id: 'inv-codice', name: 'code', required: true,
      value: invite?.code || generateInviteCode(),
    });

    const body = el('div', { class: 'stack stack--tight' }, [
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'inv-gruppo' }, 'Nome del gruppo'),
        el('input', { class: 'input', id: 'inv-gruppo', name: 'groupName', required: true, value: invite?.groupName || '' }),
        el('p', { class: 'field__hint' }, 'Come vuoi che li saluti la pagina: “Famiglia Rossi”, “Luca e Marta”.'),
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'inv-codice' }, 'Codice invito'),
        el('div', { style: 'display:flex; gap:var(--sp-2)' }, [
          codeInput,
          el('button', {
            class: 'btn btn--quiet btn--sm', type: 'button',
            onClick: () => { codeInput.value = generateInviteCode(); },
          }, 'Rigenera'),
        ]),
      ]),
      el('div', { class: 'field-row' }, [
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', for: 'inv-posti' }, 'Posti tenuti'),
          el('input', { class: 'input', id: 'inv-posti', name: 'maxSeats', type: 'number', min: 1, max: 12, value: invite?.maxSeats || 2 }),
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', for: 'inv-tel' }, 'Telefono (WhatsApp)'),
          el('input', { class: 'input', id: 'inv-tel', name: 'phone', type: 'tel', value: invite?.phone || '', placeholder: '+39 333 1234567' }),
        ]),
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'inv-nota' }, 'Nota privata'),
        el('input', { class: 'input', id: 'inv-nota', name: 'adminNote', value: invite?.adminNote || '' }),
        el('p', { class: 'field__hint' }, 'Solo per voi: gli ospiti non la vedono mai.'),
      ]),
    ]);

    const form = el('form', { id: 'form-invito', novalidate: true }, body);

    const result = await modal({
      title: isNew ? 'Nuovo gruppo invitato' : `Modifica ${invite.groupName}`,
      body: form,
      actions: (close) => [
        !isNew ? el('button', {
          class: 'btn btn--danger btn--sm', type: 'button',
          onClick: async () => {
            const sure = await confirmDialog('Eliminare l’invito?',
              `${invite.groupName} e i suoi ospiti verranno rimossi. L’operazione non si annulla.`, 'Elimina');
            if (sure) close('delete');
          },
        }, 'Elimina') : null,
        el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => close(undefined) }, 'Annulla'),
        el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => close('save') }, 'Salva'),
      ],
    });

    if (result === 'delete') {
      await repo.deleteInvite(invite.id);
      toast('Invito eliminato.');
      await reload();
      return;
    }

    if (result !== 'save') return;

    const values = formValues(form);
    if (!values.groupName || !values.code) {
      toast('Servono nome del gruppo e codice.', 'danger');
      return;
    }

    try {
      await repo.saveInvite({ ...values, id: invite?.id, needsTransport: invite?.needsTransport ?? false });
      toast(isNew ? 'Gruppo creato.' : 'Modifiche salvate.', 'ok');
      await reload();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  async function editGuests(invite) {
    const list = el('div', { class: 'stack stack--tight' });

    const drawList = (guests) => {
      render(list, guests.length
        ? guests.map((guest) => el('div', {
            style: 'display:flex; align-items:center; gap:var(--sp-3); justify-content:space-between; padding-block:var(--sp-2); border-bottom:var(--b-light)',
          }, [
            el('div', {}, [
              el('div', {}, guest.name),
              el('div', { style: 'font-size:var(--fs-xs); color:var(--t-on-light-mute)' }, [
                STATUS_META[guest.status].label,
                guest.isChild ? ' · bambino' : '',
                guest.diet ? ` · ${guest.diet}` : '',
              ].join('')),
            ]),
            el('button', {
              class: 'btn btn--danger btn--sm', type: 'button',
              onClick: async () => {
                const sure = await confirmDialog('Togliere l’ospite?', `${guest.name} verrà rimosso da questo invito.`, 'Togli');
                if (!sure) return;
                await repo.deleteGuest(guest.id);
                invite.guests = invite.guests.filter((item) => item.id !== guest.id);
                drawList(invite.guests);
                await reload();
              },
            }, 'Togli'),
          ]))
        : [el('p', { class: 'field__hint' }, 'Nessun ospite in questo gruppo.')]);
    };

    drawList(invite.guests);

    const nameInput = el('input', { class: 'input', placeholder: 'Nome e cognome', 'aria-label': 'Nome del nuovo ospite' });
    const childInput = el('input', { type: 'checkbox', id: 'nuovo-bambino' });

    const addRow = el('div', { class: 'stack stack--tight' }, [
      el('div', { style: 'display:flex; gap:var(--sp-2)' }, [
        nameInput,
        el('button', {
          class: 'btn btn--gold btn--sm', type: 'button',
          onClick: async () => {
            const name = nameInput.value.trim();
            if (!name) return;
            const guest = await repo.saveGuest({ inviteId: invite.id, name, isChild: childInput.checked, status: 'in_attesa' });
            invite.guests.push(guest);
            nameInput.value = '';
            childInput.checked = false;
            drawList(invite.guests);
            await reload();
          },
        }, 'Aggiungi'),
      ]),
      el('label', { class: 'check', for: 'nuovo-bambino' }, [childInput, el('span', {}, 'È un bambino')]),
    ]);

    await modal({
      title: `Ospiti di ${invite.groupName}`,
      body: el('div', { class: 'stack' }, [
        el('p', { class: 'field__hint' }, `Posti tenuti: ${plural(invite.maxSeats, 'persona', 'persone')}. Ogni nome qui dentro comparirà nella pagina dell’invito.`),
        list,
        addRow,
      ]),
    });
  }

  /* ---------------- disegno ----------------
     La struttura si costruisce una volta sola: ricerca e filtro
     aggiornano solo le due zone che cambiano, così il campo di
     ricerca non perde il cursore mentre si scrive.                */

  const statsSlot = el('div');
  const tableSlot = el('div');

  const searchInput = el('input', {
    class: 'input', type: 'search', placeholder: 'Cerca gruppo, nome o codice',
    'aria-label': 'Cerca fra gli invitati',
    onInput: (event) => { search = event.target.value; drawTable(); },
  });

  const filterSelect = el('select', {
    class: 'select', 'aria-label': 'Filtra per stato',
    onChange: (event) => { filter = event.target.value; drawTable(); },
  }, [
    el('option', { value: 'tutti' }, 'Tutti gli stati'),
    el('option', { value: 'confermato' }, 'Confermati'),
    el('option', { value: 'in_attesa' }, 'In attesa'),
    el('option', { value: 'assente' }, 'Non vengono'),
  ]);

  const shell = el('div', {}, [
    el('div', { class: 'panel-head' }, [
      el('div', {}, [
        el('h2', {}, 'Invitati'),
        el('p', {}, 'Ogni gruppo ha un codice: lo mandi su WhatsApp e apre la sua pagina.'),
      ]),
      el('div', { class: 'panel-actions' }, [
        el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => editInvite(null) }, 'Nuovo gruppo'),
      ]),
    ]),
    statsSlot,
    el('div', { class: 'card' }, [
      el('div', { class: 'card__head' }, [
        el('h3', { class: 'card__title' }, 'Elenco'),
        el('div', { class: 'toolbar' }, [searchInput, filterSelect]),
      ]),
      tableSlot,
    ]),
  ]);

  const drawTable = () => render(tableSlot, tableNode());

  function draw() {
    if (!root.contains(shell)) render(root, shell);
    render(statsSlot, statsNode());
    drawTable();
  }

  return { reload };
}
