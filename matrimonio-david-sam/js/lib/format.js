/** Formattazione date, orari e codici. Tutto in italiano. */

const dateLong = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

const dateShort = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

const dateTimeShort = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export const formatDateLong = (value) => dateLong.format(new Date(value));
export const formatDate = (value) => dateShort.format(new Date(value));
export const formatDateTime = (value) => dateTimeShort.format(new Date(value));

/** "16:30" da "16:30:00" o da una data ISO. */
export function formatTime(value) {
  if (!value) return '';
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

/** Parti del conto alla rovescia verso una data ISO. */
export function countdownParts(isoDate, now = Date.now()) {
  const diff = Math.max(0, new Date(isoDate).getTime() - now);
  const minutes = Math.floor(diff / 60000);
  return {
    days: Math.floor(minutes / 1440),
    hours: Math.floor((minutes % 1440) / 60),
    minutes: minutes % 60,
    expired: diff === 0,
  };
}

/** "2 persone" / "1 persona" */
export function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

const CODE_WORDS = ['CLADDAGH', 'BOYNE', 'KELLS', 'TARA', 'SHANNON', 'GALWAY', 'DINGLE', 'ARAN', 'BURREN', 'NEWGRANGE'];
const CODE_CHARS = 'ACDEFGHJKLMNPQRTUVWXY34679'; // niente caratteri ambigui (0/O, 1/I, S/5, B/8)

/** Codice invito leggibile al telefono: "GALWAY-7K2M". */
export function generateInviteCode() {
  const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  let suffix = '';
  const random = crypto.getRandomValues(new Uint32Array(4));
  for (let i = 0; i < 4; i += 1) suffix += CODE_CHARS[random[i] % CODE_CHARS.length];
  return `${word}-${suffix}`;
}

/** Normalizza quello che l'ospite digita: spazi, minuscole, trattini mancanti. */
export function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
}

/** Numero di telefono in formato wa.me (solo cifre, con prefisso). */
export function toWhatsAppNumber(raw, defaultPrefix = '39') {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.length <= 10) return defaultPrefix + digits;
  return digits;
}
