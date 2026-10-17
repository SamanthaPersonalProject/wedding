/**
 * Pannello playlist: il link Spotify che finisce nella sezione
 * "La playlist" del sito.
 *
 * Si incolla il link di condivisione e basta: l'indirizzo del player si
 * ricava da quello. L'anteprima qui dentro è lo stesso player che vedranno
 * gli ospiti, così si controlla subito di aver incollato la cosa giusta.
 */

import { el, render, toast } from '../lib/dom.js';
import { parseSpotifyLink } from '../lib/spotify.js';

const SETTING_KEY = 'playlist_spotify';

export function createPlaylistPanel(root, repo) {
  let saved = '';

  const reload = async () => {
    const settings = await repo.getSettings();
    saved = settings[SETTING_KEY] || '';
    draw();
  };

  async function save(value) {
    const trimmed = value.trim();
    if (trimmed && !parseSpotifyLink(trimmed)) {
      toast('Questo non sembra un link Spotify. Copialo da Spotify con “Condividi → Copia link”.', 'danger');
      return;
    }

    try {
      await repo.saveSetting(SETTING_KEY, trimmed);
      saved = trimmed;
      toast(trimmed ? 'Playlist salvata.' : 'Playlist tolta dal sito.', 'ok');
      draw();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  function draw() {
    const link = parseSpotifyLink(saved);

    const input = el('input', {
      class: 'input', id: 'playlist-url', name: 'url', type: 'url',
      value: saved, placeholder: 'https://open.spotify.com/playlist/…',
      onKeydown: (event) => {
        if (event.key === 'Enter') { event.preventDefault(); save(input.value); }
      },
    });

    render(root,
      el('div', { class: 'panel-head' }, [
        el('div', {}, [
          el('h2', {}, 'Playlist'),
          el('p', {}, 'Il player Spotify nella sezione “La playlist”. Senza link, la sezione non compare sul sito.'),
        ]),
      ]),

      el('div', { class: 'card card--pad' }, el('div', { class: 'stack' }, [
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', for: 'playlist-url' }, 'Link della playlist'),
          el('div', { class: 'toolbar' }, [
            input,
            el('button', { class: 'btn btn--gold btn--sm', type: 'button', onClick: () => save(input.value) }, 'Salva'),
          ]),
          el('p', { class: 'field__hint' }, 'Su Spotify: i tre puntini della playlist → Condividi → Copia link. Va bene anche un album o un singolo brano.'),
        ]),

        link
          ? el('div', { class: 'stack stack--tight' }, [
              el('p', { class: 'field__hint' }, 'Anteprima — è quello che vedranno gli ospiti:'),
              el('iframe', {
                class: 'spotify-embed',
                src: link.embedUrl,
                title: 'Anteprima della playlist',
                loading: 'lazy',
                allow: 'encrypted-media; clipboard-write; fullscreen; picture-in-picture',
                style: 'border:0; width:100%; height:352px; border-radius:12px',
              }),
              el('div', { class: 'toolbar' }, [
                el('a', { class: 'btn btn--quiet btn--sm', href: link.pageUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Apri su Spotify'),
                el('button', {
                  class: 'btn btn--danger btn--sm', type: 'button',
                  onClick: () => save(''),
                }, 'Togli la playlist'),
              ]),
            ])
          : el('div', { class: 'empty' }, el('p', {},
              'Nessuna playlist impostata: sul sito la sezione resta nascosta.')),
      ])));
  }

  return { reload };
}
