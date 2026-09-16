import { $$ } from '../lib/dom.js';
import { countdownParts } from '../lib/format.js';

/**
 * Aggiorna il conto alla rovescia. Ritorna una funzione per fermarlo.
 * @param {HTMLElement} root - contenitore con gli elementi [data-countdown]
 * @param {string} isoDate
 */
export function startCountdown(root, isoDate) {
  if (!root) return () => {};

  const slots = Object.fromEntries(
    $$('[data-countdown]', root).map((node) => [node.dataset.countdown, node]),
  );

  let timer = null;
  let done = false;

  const tick = () => {
    const { days, hours, minutes, expired } = countdownParts(isoDate);
    if (slots.days) slots.days.textContent = days;
    if (slots.hours) slots.hours.textContent = hours;
    if (slots.minutes) slots.minutes.textContent = minutes;
    if (expired) {
      root.setAttribute('aria-label', 'Il giorno è arrivato');
      done = true;
      clearInterval(timer);
    }
  };

  tick();
  if (!done) timer = setInterval(tick, 30_000);
  return () => clearInterval(timer);
}
