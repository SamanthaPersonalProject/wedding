/**
 * Pannello risposte: tutto quello che scrivono gli ospiti, in un posto solo.
 *
 * Gli stessi dati stanno già sparsi altrove — le diete dentro la modale
 * degli ospiti, le esigenze in una riga della tabella — ma lì si leggono
 * un gruppo alla volta, e quando serve la lista delle allergie serve
 * tutta insieme, da passare a chi cucina. Canzoni e messaggi invece non
 * si vedevano da nessuna parte.
 *
 * Qui non si modifica niente: si legge, si copia, si stampa.
 */

import { el, render, toast } from '../lib/dom.js';
import { formatDate, plural } from '../lib/format.js';

/** Solo il nome di battesimo, per le liste strette. */
const firstName = (name) => String(name || '').split(' ')[0];

export function createAnswersPanel(root, repo) {
  let invites = [];

  const reload = async () => {
    invites = await repo.listInvites();
    draw();
  };

  /* ---------------- raccolta ---------------- */

  /** Chi ha dichiarato allergie o diete, con il gruppo di appartenenza. */
  const diets = () => invites.flatMap((invite) =>
    invite.guests
      .filter((guest) => guest.diet?.trim())
      .map((guest) => ({ ...guest, groupName: invite.groupName })));

  /** Le esigenze di gruppo: seggiolone, difficoltà di spostamento… */
  const needs = () => invites
    .filter((invite) => invite.specialNeeds?.trim())
    .map((invite) => ({ groupName: invite.groupName, text: invite.specialNeeds }));

  const songs = () => invites
    .filter((invite) => invite.song?.trim())
    .map((invite) => ({ groupName: invite.groupName, text: invite.song }));

  /** I messaggi, dal più recente: sono quelli che si leggono per primi. */
  const messages = () => invites
    .filter((invite) => invite.message?.trim())
    .map((invite) => ({
      groupName: invite.groupName,
      text: invite.message,
      when: invite.respondedAt,
    }))
    .sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));

  /* ---------------- copia ---------------- */

  async function copy(title, lines) {
    if (!lines.length) return;
    try {
      await navigator.clipboard.writeText(`${title}\n\n${lines.join('\n')}`);
      toast('Copiato: puoi incollarlo dove vuoi.', 'ok');
    } catch {
      toast('Il browser non ha concesso la copia negli appunti.', 'danger');
    }
  }

  const copyButton = (title, lines) => el('button', {
    class: 'btn btn--quiet btn--sm',
    type: 'button',
    disabled: !lines.length,
    onClick: () => copy(title, lines),
  }, 'Copia elenco');

  /* ---------------- disegno ---------------- */

  /**
   * Un riquadro con intestazione, conteggio e pulsante di copia.
   * `rows` sono i nodi già pronti; `lines` la stessa cosa in testo piano.
   */
  function card({ title, hint, rows, lines, empty }) {
    return el('div', { class: 'card' }, [
      el('div', { class: 'card__head' }, [
        el('div', {}, [
          el('h3', { class: 'card__title' }, title),
          hint ? el('p', { class: 'field__hint' }, hint) : null,
        ]),
        el('div', { class: 'toolbar' }, [
          el('span', { class: 'field__hint' }, String(rows.length)),
          copyButton(title, lines),
        ]),
      ]),
      rows.length
        ? el('div', {}, rows)
        : el('div', { class: 'empty' }, el('p', {}, empty)),
    ]);
  }

  const line = (strong, rest, meta) => el('div', { class: 'answer-row' }, [
    el('div', { class: 'answer-row__who' }, strong),
    el('div', { class: 'answer-row__what' }, rest),
    meta ? el('div', { class: 'answer-row__meta' }, meta) : null,
  ]);

  function draw() {
    const dietList = diets();
    const needList = needs();
    const songList = songs();
    const messageList = messages();

    const answered = invites.filter((invite) => invite.respondedAt).length;

    render(root,
      el('div', { class: 'panel-head' }, [
        el('div', {}, [
          el('h2', {}, 'Risposte'),
          el('p', {}, invites.length
            ? `${plural(answered, 'gruppo ha', 'gruppi hanno')} risposto su ${invites.length}. Qui c’è quello che hanno scritto: niente si modifica da questa scheda.`
            : 'Non c’è ancora nessun invitato.'),
        ]),
        el('div', { class: 'panel-actions' }, [
          el('button', {
            class: 'btn btn--quiet btn--sm', type: 'button',
            onClick: () => window.print(),
          }, 'Stampa'),
        ]),
      ]),

      el('div', { class: 'stack' }, [
        card({
          title: 'Allergie e diete',
          hint: 'Da passare a chi cucina.',
          rows: dietList.map((guest) => line(
            guest.name,
            guest.diet,
            [guest.groupName, guest.isChild ? 'bambino' : null].filter(Boolean).join(' · '),
          )),
          lines: dietList.map((guest) => `${guest.name} (${guest.groupName}): ${guest.diet}`),
          empty: 'Nessuna allergia segnalata finora.',
        }),

        card({
          title: 'Esigenze',
          hint: 'Seggioloni, difficoltà di spostamento, arrivi in ritardo.',
          rows: needList.map((item) => line(item.groupName, item.text)),
          lines: needList.map((item) => `${item.groupName}: ${item.text}`),
          empty: 'Nessuna esigenza segnalata.',
        }),

        card({
          title: 'Canzoni richieste',
          hint: 'Materiale pronto per la playlist.',
          rows: songList.map((item) => line(item.text, '', item.groupName)),
          lines: songList.map((item) => `${item.text} — ${item.groupName}`),
          empty: 'Nessuna canzone richiesta finora.',
        }),

        card({
          title: 'Messaggi',
          hint: 'Le due righe che vi lasciano, dal più recente.',
          rows: messageList.map((item) => line(
            item.groupName,
            item.text,
            item.when ? formatDate(item.when) : null,
          )),
          lines: messageList.map((item) => `${item.groupName}: ${item.text}`),
          empty: 'Nessun messaggio, ancora.',
        }),
      ]));
  }

  return { reload };
}
