/**
 * Messaggio d'invito e link WhatsApp.
 * Il messaggio si può leggere prima di mandarlo: niente parte da solo.
 */

import { el, modal, toast } from '../lib/dom.js';
import { config, siteBaseUrl } from '../config.js';
import { toWhatsAppNumber } from '../lib/format.js';

/**
 * Link personale: apre invito.html, la pagina d'invito col loro nome.
 * Data, posti e codice stanno lì, non nel messaggio.
 */
export function inviteLink(invite) {
  return `${siteBaseUrl()}/invito.html?c=${encodeURIComponent(invite.code)}`;
}

/**
 * Testo dell'invito: due righe e il link.
 * Tutto il resto lo scoprono aprendo la pagina — è quello il regalo.
 */
export function inviteMessage(invite) {
  const { coupleFirst, coupleSecond } = config.wedding;

  return [
    `Ciao ${invite.groupName}!`,
    '',
    `${coupleFirst} e ${coupleSecond} si sposano, e questo è il vostro invito:`,
    inviteLink(invite),
    '',
    'Apritelo con calma — dentro c\'è tutto.',
  ].join('\n');
}

/** Apre WhatsApp con il messaggio già scritto, dopo un'anteprima. */
export async function openWhatsApp(invite) {
  const phone = toWhatsAppNumber(invite.phone);
  const message = inviteMessage(invite);

  const textarea = el('textarea', { class: 'textarea', rows: 12, 'aria-label': 'Messaggio' }, message);

  const choice = await modal({
    title: `Invito per ${invite.groupName}`,
    body: el('div', { class: 'stack stack--tight' }, [
      phone
        ? el('p', { class: 'field__hint' }, `Verrà aperta la chat con ${invite.phone}. Il messaggio resta modificabile prima dell'invio.`)
        : el('div', { class: 'notice notice--warn' }, [
            el('strong', {}, 'Numero mancante'),
            el('p', {}, 'Senza numero possiamo solo copiare il testo: aggiungi il telefono all’invito per aprire la chat.'),
          ]),
      textarea,
    ]),
    actions: (close) => [
      el('button', { class: 'btn btn--quiet btn--sm', type: 'button', onClick: () => close('copy') }, 'Copia testo'),
      el('button', {
        class: 'btn btn--gold btn--sm',
        type: 'button',
        disabled: !phone,
        onClick: () => close('send'),
      }, 'Apri WhatsApp'),
    ],
  });

  if (choice === 'copy') {
    await navigator.clipboard.writeText(textarea.value);
    toast('Messaggio copiato.', 'ok');
  }

  if (choice === 'send') {
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(textarea.value)}`;
    window.open(url, '_blank', 'noopener');
  }
}
