/**
 * Pagina invito personale: invito.html?c=CODICE
 *
 * È una sola schermata, senza form: legge il codice dal link, mostra
 * l'invito con i nomi giusti e rivela il codice. Da lì si passa al sito,
 * dove il codice va digitato per aprire programma, info e conferma.
 *
 * Non scrive niente sul database: qui si legge e basta.
 */

import { $, el, render, icon, toast } from '../lib/dom.js';
import { config } from '../config.js';
import { getRepository } from '../data/repository.js';
import { normalizeCode, formatDateLong, formatTime, plural } from '../lib/format.js';
import { startCountdown } from '../landing/countdown.js';

const container = $('[data-region="invito"]');

/* ---------------- pezzi comuni ---------------- */

/**
 * Uno dei due tralci d'angolo. Non usa icon() perché il ramoscello ha un
 * viewBox suo (150×92) e non quello quadrato dei simboli.
 */
function sprig(side) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 150 92');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `invito__sprig invito__sprig--${side}`);

  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#sym-sprig');
  svg.append(use);
  return svg;
}

/** Cornice della pagina: sfondo, tralci, stemma, nomi. Il resto cambia. */
function frame(...content) {
  const { coupleFirst, coupleSecond } = config.wedding;

  return el('div', { class: 'invito__sheet' }, [
    el('div', { class: 'invito__veil', 'aria-hidden': 'true' }),
    sprig('left'),
    sprig('right'),
    el('div', { class: 'wrap invito__inner' }, [
      icon('sym-triquetra', 'invito__crest'),
      el('p', { class: 'invito__welcome' }, [
        'Céad míle fáilte',
        el('em', {}, 'centomila volte benvenuti'),
      ]),
      el('h1', { class: 'invito__names' }, [
        coupleFirst,
        el('span', { class: 'invito__amp' }, '&'),
        coupleSecond,
      ]),
      ...content,
    ]),
  ]);
}

/** Riga data / luogo, con l'ora della cerimonia. */
function whenAndWhere() {
  const { dateTime, venue } = config.wedding;

  return el('div', { class: 'invito__when' }, [
    el('p', { class: 'invito__date' }, formatDateLong(dateTime)),
    el('p', { class: 'invito__place' }, [
      el('span', {}, `ore ${formatTime(dateTime)}`),
      el('span', { class: 'invito__sep', 'aria-hidden': 'true' }, '◆'),
      el('span', {}, venue),
    ]),
  ]);
}

/* ---------------- stati di errore ---------------- */

function showProblem(title, body, retry = null) {
  container.removeAttribute('aria-busy');
  render(container, frame(
    el('div', { class: 'invito__problem' }, [
      el('h2', {}, title),
      el('p', {}, body),
      retry
        ? el('button', { class: 'btn btn--ghost', type: 'button', onClick: retry }, 'Riprova')
        : null,
      el('a', { class: 'invito__link', href: 'index.html' }, 'Vai al sito delle nozze'),
    ]),
  ));
}

/* ---------------- l'invito ---------------- */

function showInvite(invite) {
  const names = invite.guests.map((guest) => guest.name);
  const seats = plural(invite.maxSeats, 'posto', 'posti');

  const countdown = el('div', { class: 'countdown invito__countdown', 'aria-label': 'Quanto manca al matrimonio' }, [
    ['days', 'giorni'], ['hours', 'ore'], ['minutes', 'minuti'],
  ].map(([key, label]) => el('div', { class: 'countdown__unit' }, [
    el('b', { class: 'countdown__value', dataset: { countdown: key } }, '—'),
    el('span', { class: 'countdown__label' }, label),
  ])));

  render(container, frame(
    el('p', { class: 'invito__eyebrow' }, 'Invito riservato a'),
    el('p', { class: 'invito__group' }, invite.groupName),

    names.length
      ? el('ul', { class: 'invito__guests' }, names.map((name) => el('li', {}, name)))
      : null,

    el('p', { class: 'invito__vow' },
      'L’amore ci ha fatti incontrare. Ora vorremmo che foste con noi quando ci diremo di sì.'),

    whenAndWhere(),
    countdown,

    el('div', { class: 'invito__seats' },
      `Vi abbiamo tenuto ${seats} al nostro tavolo.`),

    codeCard(invite.code),

    el('div', { class: 'invito__go' }, [
      el('a', { class: 'btn btn--gold', href: 'index.html#invito' }, 'Apri il sito e conferma'),
      el('p', { class: 'invito__go-hint' },
        `Il codice serve lì: apre il programma, le informazioni pratiche e la conferma di presenza. Vi aspettiamo entro ${formatDateLong(config.wedding.rsvpDeadline)}.`),
    ]),
  ));

  container.removeAttribute('aria-busy');
  startCountdown(countdown, config.wedding.dateTime);
}

/** Il codice, scoperto qui e non nel messaggio. Un tap lo copia. */
function codeCard(code) {
  const value = el('b', { class: 'invito__code-value' }, code);

  const copy = el('button', {
    class: 'invito__code-copy',
    type: 'button',
    'aria-label': `Copia il codice ${code}`,
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(code);
        toast('Codice copiato.', 'ok');
      } catch {
        // niente clipboard (http, permessi): resta la selezione a mano
        getSelection()?.selectAllChildren(value);
        toast('Copiatelo a mano: è già selezionato.', 'info');
      }
    },
  }, 'Copia');

  return el('div', { class: 'invito__code' }, [
    icon('sym-shamrock', 'invito__code-ornament'),
    el('p', { class: 'invito__code-label' }, 'Il vostro codice invito'),
    value,
    copy,
  ]);
}

/* ---------------- avvio ---------------- */

async function boot() {
  const code = normalizeCode(new URLSearchParams(window.location.search).get('c') || '');

  if (!code) {
    showProblem(
      'Manca il codice',
      'Questo indirizzo va aperto dal link che vi abbiamo mandato: è quello che sa chi siete. Se l’avete perso, scriveteci pure.',
    );
    return;
  }

  const load = async () => {
    container.setAttribute('aria-busy', 'true');
    try {
      const repo = await getRepository();
      const result = await repo.verifyInvite(code);

      if (!result) {
        showProblem(
          'Questo invito non risulta',
          'Può essere che il link si sia spezzato copiandolo. Riprovate dal messaggio originale, oppure scriveteci: lo sistemiamo noi.',
        );
        return;
      }

      // Il codice NON viene ricordato di proposito: sul sito va digitato,
      // ed è quello il momento in cui l'invito si apre davvero.
      document.title = `Invito per ${result.invite.groupName} — David & Samantha`;
      showInvite(result.invite);
    } catch (err) {
      showProblem(
        'Non riusciamo ad aprirlo adesso',
        err.message || 'Qualcosa non ha funzionato. Riprovate tra poco.',
        load,
      );
    }
  };

  await load();
}

boot();
