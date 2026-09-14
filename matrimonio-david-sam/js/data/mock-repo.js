/**
 * Implementazione demo: tutto nel localStorage del browser.
 * Serve per provare il sito e il portale senza aver ancora creato il
 * progetto Supabase. Stessa firma di supabase-repo.js.
 */

import { DataError } from './repository.js';
import { normalizeCode } from '../lib/format.js';

const STORE_KEY = 'nozze:demo:v1';
const SESSION_KEY = 'nozze:demo:session';

const uid = () => crypto.randomUUID();

function seed() {
  const inviteA = uid();
  const inviteB = uid();

  return {
    invites: [
      {
        id: inviteA,
        code: 'GALWAY-7K2M',
        groupName: 'Famiglia Rossi',
        maxSeats: 3,
        phone: '+39 333 1234567',
        adminNote: 'Zii di David, arrivano il venerdì mattina.',
        needsTransport: true,
        respondedAt: new Date().toISOString(),
        message: 'Non vediamo l’ora!',
        song: 'The Parting Glass',
        guests: [
          { id: uid(), inviteId: inviteA, name: 'Marco Rossi', isChild: false, status: 'confermato', diet: '' },
          { id: uid(), inviteId: inviteA, name: 'Chiara Rossi', isChild: false, status: 'confermato', diet: 'Senza glutine' },
          { id: uid(), inviteId: inviteA, name: 'Emma Rossi', isChild: true, status: 'confermato', diet: '' },
        ],
      },
      {
        id: inviteB,
        code: 'BOYNE-4XQP',
        groupName: 'Luca Bianchi',
        maxSeats: 2,
        phone: '+39 347 7654321',
        adminNote: '',
        needsTransport: false,
        respondedAt: null,
        message: '',
        song: '',
        guests: [
          { id: uid(), inviteId: inviteB, name: 'Luca Bianchi', isChild: false, status: 'in_attesa', diet: '' },
          { id: uid(), inviteId: inviteB, name: 'Accompagnatore', isChild: false, status: 'in_attesa', diet: '' },
        ],
      },
    ],

    timeline: [
      { id: uid(), time: '15:30', title: 'Arrivo degli ospiti', position: 1, published: true,
        description: 'Accoglienza sulla riva con le uilleann pipes, la cornamusa irlandese: si suona da seduti, col mantice sotto il gomito.' },
      { id: uid(), time: '16:30', title: 'Cerimonia, campana e handfasting', position: 2, published: true,
        description: 'Si apre con la campana delle nozze, che in Irlanda allontana gli spiriti cattivi. Alla fine le nostre mani verranno legate con una fascia di tartan: è l’handfasting.' },
      { id: uid(), time: '17:30', title: 'Aperitivo sull’acqua', position: 3, published: true,
        description: 'Foto, brindisi e un po’ di respiro. Portate una giacca: sul lago, quando cala il sole, cambia tutto.' },
      { id: uid(), time: '19:30', title: 'Cena e brindisi con l’idromele', position: 4, published: true,
        description: 'Gli sposi irlandesi ricevevano idromele a sufficienza per un intero ciclo lunare: da lì viene mí na meala, il mese del miele.' },
      { id: uid(), time: '22:00', title: 'Torta e céilí', position: 5, published: true,
        description: 'Danze irlandesi di gruppo: nessuno sa ballarle, ma c’è chi chiama i passi prima di ogni giro.' },
      { id: uid(), time: '01:00', title: 'Ultimo giro', position: 6, published: true,
        description: 'Chi vuole resta ancora un po’. Chi guida, guidi piano.' },
    ],

    info: [
      { id: uid(), category: 'Buono a sapersi', title: 'Come arrivare al Lago Bagatol', position: 1, published: true, url: '',
        description: 'Parcheggio interno riservato agli ospiti. L’ultimo tratto è sterrato: andate piano e lasciate perdere le scarpe chiare.' },
      { id: uid(), category: 'Dove dormire', title: 'Camere convenzionate', position: 2, published: true, url: '',
        description: 'Abbiamo bloccato alcune camere a tariffa ridotta. Prenotate entro marzo 2027 citando “David & Samantha”.' },
      { id: uid(), category: 'Trasporto', title: 'Navetta serale', position: 3, published: true, url: '',
        description: 'Navetta gratuita dal lago agli hotel convenzionati, partenze all’01:00 e alle 02:00. Segnalatecelo nell’RSVP.' },
    ],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // storage non disponibile o dato corrotto: si riparte dal seme
  }
  const fresh = seed();
  save(fresh);
  return fresh;
}

function save(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // in modalità demo una scrittura persa non è un problema da mostrare
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const byPosition = (a, b) => a.position - b.position;

export function createMockRepository() {
  let state = load();

  const persist = () => save(state);

  const published = (items) => items.filter((item) => item.published).sort(byPosition);

  const requireAuth = () => {
    if (!sessionUser()) throw new DataError('Sessione scaduta: rientra nel portale.');
  };

  const sessionUser = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  return {
    mode: 'demo',

    /* ---------------- pubblico ---------------- */

    async verifyInvite(rawCode) {
      const code = normalizeCode(rawCode);
      const invite = state.invites.find((item) => item.code === code);
      if (!invite) return null;
      return {
        invite: clone(invite),
        timeline: clone(published(state.timeline)),
        info: clone(published(state.info)),
      };
    },

    async getPublicContent() {
      return {
        timeline: clone(published(state.timeline)),
        info: clone(published(state.info)),
      };
    },

    async submitRsvp(rawCode, payload) {
      const code = normalizeCode(rawCode);
      const invite = state.invites.find((item) => item.code === code);
      if (!invite) throw new DataError('Codice non riconosciuto.');

      for (const answer of payload.guests) {
        const guest = invite.guests.find((item) => item.id === answer.id);
        if (!guest) continue;
        guest.status = answer.status;
        guest.diet = answer.diet || '';
      }

      invite.needsTransport = Boolean(payload.needsTransport);
      invite.message = payload.message || '';
      invite.song = payload.song || '';
      invite.respondedAt = new Date().toISOString();

      persist();
      return clone(invite);
    },

    /* ---------------- accesso ---------------- */

    async signIn(email, password) {
      if (password !== 'demo') {
        throw new DataError('In modalità demo la password è “demo”.');
      }
      const user = { email };
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return user;
    },

    async signOut() {
      localStorage.removeItem(SESSION_KEY);
    },

    async currentUser() {
      return sessionUser();
    },

    /* ---------------- inviti ---------------- */

    async listInvites() {
      requireAuth();
      return clone(state.invites).sort((a, b) => a.groupName.localeCompare(b.groupName, 'it'));
    },

    async saveInvite(data) {
      requireAuth();
      const duplicate = state.invites.find((item) => item.code === data.code && item.id !== data.id);
      if (duplicate) throw new DataError(`Il codice ${data.code} è già assegnato a ${duplicate.groupName}.`);

      if (data.id) {
        const invite = state.invites.find((item) => item.id === data.id);
        if (!invite) throw new DataError('Invito non trovato.');
        Object.assign(invite, { ...data, guests: invite.guests });
        persist();
        return clone(invite);
      }

      const invite = {
        ...data,
        id: uid(),
        respondedAt: null,
        message: '',
        song: '',
        guests: [],
      };
      state.invites.push(invite);
      persist();
      return clone(invite);
    },

    async deleteInvite(id) {
      requireAuth();
      state.invites = state.invites.filter((item) => item.id !== id);
      persist();
    },

    async saveGuest(data) {
      requireAuth();
      const invite = state.invites.find((item) => item.id === data.inviteId);
      if (!invite) throw new DataError('Invito non trovato.');

      if (data.id) {
        const guest = invite.guests.find((item) => item.id === data.id);
        if (!guest) throw new DataError('Ospite non trovato.');
        Object.assign(guest, data);
        persist();
        return clone(guest);
      }

      const guest = { ...data, id: uid(), status: data.status || 'in_attesa', diet: data.diet || '' };
      invite.guests.push(guest);
      persist();
      return clone(guest);
    },

    async deleteGuest(id) {
      requireAuth();
      for (const invite of state.invites) {
        invite.guests = invite.guests.filter((guest) => guest.id !== id);
      }
      persist();
    },

    /* ---------------- programma ---------------- */

    async listTimeline() {
      requireAuth();
      return clone(state.timeline).sort(byPosition);
    },

    async saveTimelineItem(data) {
      requireAuth();
      if (data.id) {
        const item = state.timeline.find((entry) => entry.id === data.id);
        if (!item) throw new DataError('Voce non trovata.');
        Object.assign(item, data);
        persist();
        return clone(item);
      }
      const item = { ...data, id: uid(), position: state.timeline.length + 1 };
      state.timeline.push(item);
      persist();
      return clone(item);
    },

    async deleteTimelineItem(id) {
      requireAuth();
      state.timeline = state.timeline.filter((item) => item.id !== id);
      persist();
    },

    async reorderTimeline(orderedIds) {
      requireAuth();
      orderedIds.forEach((id, index) => {
        const item = state.timeline.find((entry) => entry.id === id);
        if (item) item.position = index + 1;
      });
      persist();
    },

    /* ---------------- info utili ---------------- */

    async listInfo() {
      requireAuth();
      return clone(state.info).sort(byPosition);
    },

    async saveInfoItem(data) {
      requireAuth();
      if (data.id) {
        const item = state.info.find((entry) => entry.id === data.id);
        if (!item) throw new DataError('Scheda non trovata.');
        Object.assign(item, data);
        persist();
        return clone(item);
      }
      const item = { ...data, id: uid(), position: state.info.length + 1 };
      state.info.push(item);
      persist();
      return clone(item);
    },

    async deleteInfoItem(id) {
      requireAuth();
      state.info = state.info.filter((item) => item.id !== id);
      persist();
    },

    /** Solo demo: riporta i dati al seme iniziale. */
    async resetDemo() {
      state = seed();
      persist();
    },
  };
}
