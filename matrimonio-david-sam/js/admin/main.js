/** Portale sposi: accesso, schede e avvio dei pannelli. */

import { $, $$, toast } from '../lib/dom.js';
import { getRepository, isDemoMode } from '../data/repository.js';
import { createGuestsPanel } from './guests.js';
import { createTimelinePanel } from './timeline.js';
import { createInfoPanel } from './info.js';

const loginScreen = $('#schermata-accesso');
const appScreen = $('#schermata-portale');
const loginForm = $('#form-accesso');
const loginError = $('#accesso-errore');
const loginButton = $('#accesso-invia');

let repo = null;
let panels = null;

/* ---------------- schede ---------------- */

function setupTabs() {
  const tabs = $$('.tab');

  const select = (name) => {
    for (const tab of tabs) {
      const active = tab.dataset.panel === name;
      tab.setAttribute('aria-selected', String(active));
      $(`#pannello-${tab.dataset.panel}`).hidden = !active;
    }
    panels[name].reload().catch((err) => toast(err.message, 'danger'));
  };

  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab.dataset.panel));
  }

  // frecce sinistra/destra fra le schede, come da pratica ARIA
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('keydown', (event) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      next.focus();
      next.click();
    });
  }

  select('invitati');
}

/* ---------------- sessione ---------------- */

async function enterApp(user) {
  loginScreen.hidden = true;
  appScreen.hidden = false;
  $('#utente-corrente').textContent = user.email;

  if (isDemoMode) {
    $('#avviso-demo').hidden = false;
    $('#reset-demo').addEventListener('click', async () => {
      await repo.resetDemo();
      toast('Dati di esempio ripristinati.');
      await Promise.all(Object.values(panels).map((panel) => panel.reload()));
    });
  }

  panels = {
    invitati: createGuestsPanel($('#pannello-invitati'), repo),
    programma: createTimelinePanel($('#pannello-programma'), repo),
    info: createInfoPanel($('#pannello-info'), repo),
  };

  setupTabs();

  $('#esci').addEventListener('click', async () => {
    await repo.signOut();
    window.location.reload();
  });
}

function showLoginError(message) {
  loginError.textContent = message;
  loginError.hidden = false;
}

async function boot() {
  repo = await getRepository();

  $('#accesso-modo').textContent = isDemoMode
    ? 'Modalità demo: entra con una email qualsiasi e la password “demo”.'
    : 'Accesso riservato agli sposi.';

  const user = await repo.currentUser();
  if (user) {
    await enterApp(user);
    return;
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.hidden = true;

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;

    if (!email || !password) {
      showLoginError('Servono email e password.');
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = 'Verifica…';

    try {
      const signedIn = await repo.signIn(email, password);
      await enterApp(signedIn);
    } catch (err) {
      showLoginError(err.message || 'Accesso non riuscito.');
      loginButton.disabled = false;
      loginButton.textContent = 'Entra';
    }
  });
}

boot();
