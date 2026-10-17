/**
 * Da un link Spotify incollato al volo ai due indirizzi che servono:
 * quello del player da incorporare e quello della pagina da aprire.
 *
 * Si accettano le forme che Spotify produce davvero quando si usa
 * "Condividi": link normale, link con la lingua dentro
 * (open.spotify.com/intl-it/playlist/…) e URI dell'app
 * (spotify:playlist:…). Anche il solo identificativo, se qualcuno
 * copia a metà.
 */

const TYPES = ['playlist', 'album', 'track', 'artist', 'episode', 'show'];
const ID = '[A-Za-z0-9]{22}';

/**
 * @param {string} raw
 * @returns {{type: string, id: string, pageUrl: string, embedUrl: string}|null}
 */
export function parseSpotifyLink(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  const types = TYPES.join('|');
  const patterns = [
    new RegExp(`^spotify:(${types}):(${ID})$`),
    new RegExp(`open\\.spotify\\.com/(?:intl-[a-z]{2}/)?(${types})/(${ID})`),
    new RegExp(`open\\.spotify\\.com/embed/(${types})/(${ID})`),
  ];

  for (const pattern of patterns) {
    const found = value.match(pattern);
    if (found) return build(found[1], found[2]);
  }

  // Solo l'identificativo: si assume una playlist, il caso di gran lunga
  // più frequente qui dentro.
  if (new RegExp(`^${ID}$`).test(value)) return build('playlist', value);

  return null;
}

function build(type, id) {
  return {
    type,
    id,
    pageUrl: `https://open.spotify.com/${type}/${id}`,
    embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
  };
}
