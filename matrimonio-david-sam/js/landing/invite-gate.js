/**
 * Area invito: codice → dettagli del gruppo → conferma.
 * È l'unico punto della landing che scrive sul database.
 */

import { el, render, toast } from '../lib/dom.js';
import { normalizeCode, formatDateLong, plural } from '../lib/format.js';
import { config } from '../config.js';

const STORED_CODE = 'nozze:ultimo-codice';

export function createInviteGate(container, repo) {
  let current = null; // {invite, timeline, info}

  /* ---------------- schermata 1: il codice ---------------- */

  function showCodeForm({ presetCode = '', error = '' } = {}) {
    const input = el('input', {
      class: 'input input--code',
      id: 'codice-invito',
      name: 'codice',
      type: 'text',
      autocomplete: 'off',
      autocapitalize: 'characters',
      spellcheck: false,
      placeholder: 'GALWAY-7K2M',
      value: presetCode,
      'aria-describedby': 'codice-aiuto',
      'aria-invalid': error ? 'true' : null,
    });

    const submit = el('button', { class: 'btn btn--gold', type: 'submit' }, 'Apri il mio invito');

    const form = el('form', {
      class: 'invite__form',
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        const code = normalizeCode(input.value);

        if (code.length < 4) {
          showCodeForm({ presetCode: input.value, error: 'Il codice è quello che trovi sulla tua pagina d’invito.' });
          return;
        }

        submit.disabled = true;
        submit.replaceChildren(el('span', { class: 'spinner' }), document.createTextNode('Verifica…'));

        try {
          const result = await repo.verifyInvite(code);
          if (!result) {
            showCodeForm({ presetCode: code, error: 'Questo codice non risulta. Ricontrolla la tua pagina d’invito, oppure scrivici: lo sistemiamo noi.' });
            return;
          }
          localStorage.setItem(STORED_CODE, code);
          current = result;
          showInviteCard();
        } catch (err) {
          showCodeForm({ presetCode: code, error: err.message || 'Qualcosa non ha funzionato. Riprova tra poco.' });
        }
      },
    }, [
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'codice-invito' }, 'Codice invito'),
        input,
        el('p', { class: 'field__hint', id: 'codice-aiuto' }, 'Lo trovi sulla tua pagina d’invito, quella del link che ti abbiamo mandato.'),
        error ? el('p', { class: 'field__error', role: 'alert' }, error) : null,
      ]),
      submit,
    ]);

    render(container,
      el('p', { class: 'prose' }, 'Ogni invito ha un codice: lo trovate sulla vostra pagina d’invito e apre da qui il programma, le informazioni pratiche e la conferma di presenza.'),
      form);

    if (presetCode) input.focus();
  }

  /* ---------------- schermata 2: l'invito ---------------- */

  function showInviteCard() {
    const { invite } = current;
    const alreadyAnswered = Boolean(invite.respondedAt);

    const guestRows = invite.guests.map(buildGuestRow);

    const transport = el('input', { type: 'checkbox', id: 'navetta', name: 'navetta', checked: invite.needsTransport });
    const song = el('input', { class: 'input', id: 'canzone', name: 'canzone', type: 'text', value: invite.song || '' });
    const message = el('textarea', { class: 'textarea', id: 'messaggio', name: 'messaggio' }, invite.message || '');

    const submit = el('button', { class: 'btn btn--gold', type: 'submit' },
      alreadyAnswered ? 'Aggiorna la risposta' : 'Invia la conferma');

    const form = el('form', {
      class: 'stack',
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();

        const answers = guestRows.map((row) => row.read());
        const undecided = answers.filter((answer) => answer.status === 'in_attesa');
        if (undecided.length) {
          toast('Manca la risposta per qualcuno del gruppo.', 'danger');
          return;
        }

        submit.disabled = true;
        submit.replaceChildren(el('span', { class: 'spinner' }), document.createTextNode('Salvataggio…'));

        try {
          const saved = await repo.submitRsvp(invite.code, {
            guests: answers,
            needsTransport: transport.checked,
            song: song.value.trim(),
            message: message.value.trim(),
          });
          current = { ...current, invite: saved };
          showThanks();
        } catch (err) {
          submit.disabled = false;
          submit.textContent = 'Riprova';
          toast(err.message || 'Non siamo riusciti a salvare. Riprova.', 'danger');
        }
      },
    }, [
      el('div', { class: 'guest-list' }, guestRows.map((row) => row.node)),

      el('div', { class: 'field' }, [
        el('label', { class: 'check', for: 'navetta' }, [transport, el('span', {}, 'Ci serve la navetta serale per rientrare in hotel')]),
      ]),

      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'canzone' }, 'Una canzone che vi farebbe alzare dalla sedia'),
        song,
      ]),

      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'messaggio' }, 'Due righe per noi'),
        message,
      ]),

      el('div', {}, submit),
    ]);

    render(container, el('div', { class: 'invite__card' }, [
      el('div', { class: 'invite__card-head' }, [
        el('div', {}, [
          el('p', { class: 'invite__section-title' }, 'Invito riservato a'),
          el('p', { class: 'invite__group' }, invite.groupName),
        ]),
        el('p', { class: 'invite__seats' }, `${plural(invite.maxSeats, 'posto tenuto', 'posti tenuti')} per voi`),
      ]),

      alreadyAnswered
        ? el('div', { class: 'notice notice--ok' }, [
            el('strong', {}, 'Abbiamo già la vostra risposta.'),
            el('p', {}, 'Potete cambiarla da qui fino al ' + formatDateLong(config.wedding.rsvpDeadline) + '.'),
          ])
        : null,

      form,

      el('button', {
        class: 'btn btn--quiet btn--sm',
        type: 'button',
        onClick: () => { current = null; showCodeForm(); },
      }, 'Non è il tuo invito? Cambia codice'),
    ]));

    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Una riga per ospite: nome, sì/no, eventuale dieta. */
  function buildGuestRow(guest) {
    const group = `stato-${guest.id}`;

    const yes = el('input', { type: 'radio', name: group, value: 'confermato', checked: guest.status === 'confermato' });
    const no = el('input', { type: 'radio', name: group, value: 'assente', checked: guest.status === 'assente' });

    const diet = el('input', {
      class: 'input',
      type: 'text',
      value: guest.diet || '',
      placeholder: 'Allergie o preferenze a tavola',
      'aria-label': `Allergie o preferenze di ${guest.name}`,
    });

    const extra = el('div', { class: 'guest-row__extra', hidden: guest.status !== 'confermato' }, diet);

    const syncExtra = () => { extra.hidden = !yes.checked; };
    yes.addEventListener('change', syncExtra);
    no.addEventListener('change', syncExtra);

    const node = el('div', { class: 'guest-row' }, [
      el('div', {}, [
        el('p', { class: 'guest-row__name' }, guest.name),
        guest.isChild ? el('p', { class: 'guest-row__tag' }, 'Bambino') : null,
      ]),
      el('div', { class: 'guest-row__choice' }, [
        el('label', { class: 'choice' }, [yes, el('span', {}, 'Ci sarò')]),
        el('label', { class: 'choice' }, [no, el('span', {}, 'Non posso')]),
      ]),
      extra,
    ]);

    return {
      node,
      read: () => ({
        id: guest.id,
        status: yes.checked ? 'confermato' : no.checked ? 'assente' : 'in_attesa',
        diet: yes.checked ? diet.value.trim() : '',
      }),
    };
  }

  /* ---------------- schermata 3: grazie ---------------- */

  function showThanks() {
    const { invite } = current;
    const coming = invite.guests.filter((guest) => guest.status === 'confermato');

    render(container, el('div', { class: 'invite__card' }, [
      el('h3', { class: 'invite__group' }, coming.length ? 'Grazie, ci vediamo il 21 maggio.' : 'Grazie per avercelo detto.'),
      el('div', { class: 'prose' }, [
        coming.length
          ? el('p', {}, `Abbiamo segnato ${plural(coming.length, 'posto', 'posti')} a nome di ${invite.groupName}: ${coming.map((guest) => guest.name).join(', ')}.`)
          : el('p', {}, 'Ci mancherete. Se cambia qualcosa, potete rientrare con lo stesso codice.'),
        invite.needsTransport ? el('p', {}, 'Vi teniamo un posto sulla navetta serale.') : null,
        el('p', {}, `Si può modificare fino al ${formatDateLong(config.wedding.rsvpDeadline)}.`),
      ]),
      el('button', {
        class: 'btn btn--quiet btn--sm',
        type: 'button',
        onClick: () => showInviteCard(),
      }, 'Modifica la risposta'),
    ]));
  }

  /* ---------------- avvio ---------------- */

  return {
    async start() {
      const fromLink = new URLSearchParams(window.location.search).get('c');
      const remembered = localStorage.getItem(STORED_CODE);
      const preset = normalizeCode(fromLink || remembered || '');

      showCodeForm({ presetCode: preset });

      // Un link con ?c=CODICE apre direttamente l'invito.
      if (fromLink) {
        try {
          const result = await repo.verifyInvite(preset);
          if (result) {
            localStorage.setItem(STORED_CODE, preset);
            current = result;
            showInviteCard();
          }
        } catch {
          // resta la schermata del codice, l'ospite riprova a mano
        }
      }
    },
  };
}
