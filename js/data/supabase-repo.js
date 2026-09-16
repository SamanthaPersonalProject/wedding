/**
 * Implementazione Supabase.
 *
 * Due regole che vale la pena non perdere di vista:
 *
 * 1. Gli ospiti NON leggono le tabelle. Passano per le funzioni
 *    `verifica_invito` e `conferma_invito` (SECURITY DEFINER), che
 *    restituiscono solo il gruppo corrispondente al codice. Con RLS attiva
 *    e nessuna policy per il ruolo anon, la chiave pubblica in pagina non
 *    permette di scaricare la lista invitati.
 *
 * 2. Il database parla italiano e snake_case, l'applicazione camelCase.
 *    La traduzione vive qui dentro e in nessun altro posto.
 */

import { getSupabaseClient } from '../lib/supabase-client.js';
import { DataError } from './repository.js';
import { normalizeCode } from '../lib/format.js';

/* ---------------- mappatura DB → applicazione ---------------- */

const toGuest = (row) => ({
  id: row.id,
  inviteId: row.invito_id,
  name: row.nome,
  isChild: row.bambino,
  status: row.stato,
  diet: row.dieta ?? '',
});

const toInvite = (row) => ({
  id: row.id,
  code: row.codice,
  groupName: row.nome_gruppo,
  maxSeats: row.posti_max,
  phone: row.telefono ?? '',
  adminNote: row.nota_admin ?? '',
  needsTransport: row.navetta ?? false,
  respondedAt: row.risposto_il,
  message: row.messaggio ?? '',
  song: row.canzone ?? '',
  guests: (row.ospiti ?? []).map(toGuest),
});

const toTimelineItem = (row) => ({
  id: row.id,
  time: (row.ora ?? '').slice(0, 5),
  title: row.titolo,
  description: row.descrizione ?? '',
  position: row.posizione,
  published: row.pubblicato,
});

const toInfoItem = (row) => ({
  id: row.id,
  category: row.categoria || 'Buono a sapersi',
  title: row.titolo,
  description: row.descrizione ?? '',
  url: row.url ?? '',
  position: row.posizione,
  published: row.pubblicato,
});

/* ---------------- mappatura applicazione → DB ---------------- */

const fromInvite = (invite) => ({
  codice: invite.code,
  nome_gruppo: invite.groupName,
  posti_max: Number(invite.maxSeats) || 1,
  telefono: invite.phone || null,
  nota_admin: invite.adminNote || null,
  navetta: Boolean(invite.needsTransport),
});

const fromGuest = (guest) => ({
  invito_id: guest.inviteId,
  nome: guest.name,
  bambino: Boolean(guest.isChild),
  stato: guest.status || 'in_attesa',
  dieta: guest.diet || null,
});

const fromTimelineItem = (item) => ({
  ora: item.time,
  titolo: item.title,
  descrizione: item.description || null,
  posizione: item.position ?? 999,
  pubblicato: item.published !== false,
});

const fromInfoItem = (item) => ({
  categoria: item.category?.trim() || 'Buono a sapersi',
  titolo: item.title,
  descrizione: item.description || null,
  url: item.url || null,
  posizione: item.position ?? 999,
  pubblicato: item.published !== false,
});

/** Traduce gli errori Postgres in frasi leggibili. */
function explain(error, fallback) {
  if (!error) return null;
  if (error.code === '23505') return new DataError('Questo codice invito esiste già: generane un altro.');
  if (error.code === '42501' || error.message?.includes('row-level security')) {
    return new DataError('Permesso negato: rientra nel portale e riprova.');
  }
  if (error.message?.includes('Invalid login credentials')) {
    return new DataError('Email o password non corretti.');
  }
  return new DataError(fallback, error);
}

export async function createSupabaseRepository() {
  const db = await getSupabaseClient();

  const guard = (error, fallback) => {
    const wrapped = explain(error, fallback);
    if (wrapped) throw wrapped;
  };

  return {
    mode: 'supabase',

    /* ---------------- pubblico ---------------- */

    async verifyInvite(rawCode) {
      const { data, error } = await db.rpc('verifica_invito', { p_codice: normalizeCode(rawCode) });
      guard(error, 'Non riusciamo a verificare il codice in questo momento.');
      // Anche la presenza dell'id, non solo dell'oggetto: una funzione che
      // tornasse un record vuoto non deve mai passare per invito valido.
      if (!data?.invito?.id) return null;

      return {
        invite: toInvite({ ...data.invito, ospiti: data.ospiti }),
        timeline: (data.programma ?? []).map(toTimelineItem),
        info: (data.info ?? []).map(toInfoItem),
      };
    },

    async getPublicContent() {
      const { data, error } = await db.rpc('contenuti_pubblici');
      guard(error, 'Non riusciamo a caricare il programma.');
      return {
        timeline: (data?.programma ?? []).map(toTimelineItem),
        info: (data?.info ?? []).map(toInfoItem),
      };
    },

    async submitRsvp(rawCode, payload) {
      const { data, error } = await db.rpc('conferma_invito', {
        p_codice: normalizeCode(rawCode),
        p_risposta: {
          ospiti: payload.guests.map((guest) => ({ id: guest.id, stato: guest.status, dieta: guest.diet || null })),
          navetta: Boolean(payload.needsTransport),
          messaggio: payload.message || null,
          canzone: payload.song || null,
        },
      });
      guard(error, 'Non siamo riusciti a salvare la risposta. Riprova tra poco.');
      if (!data?.invito) throw new DataError('Codice non riconosciuto.');
      return toInvite({ ...data.invito, ospiti: data.ospiti });
    },

    /* ---------------- accesso ---------------- */

    async signIn(email, password) {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      guard(error, 'Accesso non riuscito.');
      return { email: data.user.email };
    },

    async signOut() {
      await db.auth.signOut();
    },

    async currentUser() {
      const { data } = await db.auth.getUser();
      return data?.user ? { email: data.user.email } : null;
    },

    /* ---------------- inviti ---------------- */

    async listInvites() {
      const { data, error } = await db
        .from('inviti')
        .select('*, ospiti(*)')
        .order('nome_gruppo', { ascending: true });
      guard(error, 'Non riusciamo a caricare gli inviti.');
      return (data ?? []).map(toInvite);
    },

    async saveInvite(invite) {
      const payload = fromInvite(invite);

      if (invite.id) {
        const { data, error } = await db.from('inviti').update(payload).eq('id', invite.id).select('*, ospiti(*)').single();
        guard(error, 'Non riusciamo a salvare l’invito.');
        return toInvite(data);
      }

      const { data, error } = await db.from('inviti').insert(payload).select('*, ospiti(*)').single();
      guard(error, 'Non riusciamo a creare l’invito.');
      return toInvite(data);
    },

    async deleteInvite(id) {
      const { error } = await db.from('inviti').delete().eq('id', id);
      guard(error, 'Non riusciamo a eliminare l’invito.');
    },

    async saveGuest(guest) {
      const payload = fromGuest(guest);

      if (guest.id) {
        const { data, error } = await db.from('ospiti').update(payload).eq('id', guest.id).select().single();
        guard(error, 'Non riusciamo a salvare l’ospite.');
        return toGuest(data);
      }

      const { data, error } = await db.from('ospiti').insert(payload).select().single();
      guard(error, 'Non riusciamo ad aggiungere l’ospite.');
      return toGuest(data);
    },

    async deleteGuest(id) {
      const { error } = await db.from('ospiti').delete().eq('id', id);
      guard(error, 'Non riusciamo a eliminare l’ospite.');
    },

    /* ---------------- programma ---------------- */

    async listTimeline() {
      const { data, error } = await db.from('programma').select('*').order('posizione');
      guard(error, 'Non riusciamo a caricare il programma.');
      return (data ?? []).map(toTimelineItem);
    },

    async saveTimelineItem(item) {
      const payload = fromTimelineItem(item);

      if (item.id) {
        const { data, error } = await db.from('programma').update(payload).eq('id', item.id).select().single();
        guard(error, 'Non riusciamo a salvare la voce.');
        return toTimelineItem(data);
      }

      const { data, error } = await db.from('programma').insert(payload).select().single();
      guard(error, 'Non riusciamo ad aggiungere la voce.');
      return toTimelineItem(data);
    },

    async deleteTimelineItem(id) {
      const { error } = await db.from('programma').delete().eq('id', id);
      guard(error, 'Non riusciamo a eliminare la voce.');
    },

    async reorderTimeline(orderedIds) {
      const { error } = await db.rpc('riordina_programma', { p_ids: orderedIds });
      guard(error, 'Non riusciamo a salvare il nuovo ordine.');
    },

    /* ---------------- info utili ---------------- */

    async listInfo() {
      const { data, error } = await db.from('info_utili').select('*').order('posizione');
      guard(error, 'Non riusciamo a caricare le informazioni.');
      return (data ?? []).map(toInfoItem);
    },

    async saveInfoItem(item) {
      const payload = fromInfoItem(item);

      if (item.id) {
        const { data, error } = await db.from('info_utili').update(payload).eq('id', item.id).select().single();
        guard(error, 'Non riusciamo a salvare la scheda.');
        return toInfoItem(data);
      }

      const { data, error } = await db.from('info_utili').insert(payload).select().single();
      guard(error, 'Non riusciamo ad aggiungere la scheda.');
      return toInfoItem(data);
    },

    async deleteInfoItem(id) {
      const { error } = await db.from('info_utili').delete().eq('id', id);
      guard(error, 'Non riusciamo a eliminare la scheda.');
    },
  };
}
