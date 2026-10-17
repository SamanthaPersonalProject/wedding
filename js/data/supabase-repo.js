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
  respondedAt: row.risposto_il,
  message: row.messaggio ?? '',
  song: row.canzone ?? '',
  specialNeeds: row.esigenze ?? '',
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

const toDressCodeItem = (row) => ({
  id: row.id,
  text: row.testo,
  position: row.posizione,
  published: row.pubblicato,
});

const toSectionItem = (row) => ({
  key: row.chiave,
  label: row.etichetta,
  position: row.posizione,
  published: row.pubblicato,
});

const toPhotoItem = (row) => ({
  id: row.id,
  url: row.url,
  caption: row.didascalia ?? '',
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

const fromDressCodeItem = (item) => ({
  testo: item.text,
  posizione: item.position ?? 999,
  pubblicato: item.published !== false,
});

const fromPhotoItem = (item) => ({
  url: item.url,
  didascalia: item.caption || null,
  posizione: item.position ?? 999,
  pubblicato: item.published !== false,
});

/** Traduce gli errori Postgres in frasi leggibili. */
function explain(error, fallback) {
  if (!error) return null;
  if (error.code === '23505') return new DataError('Questo codice invito esiste già: generane un altro.');
  // Tabella o funzione che il database non conosce: manca l'ultima versione
  // dello schema. Succede quando si aggiorna il sito ma non il database.
  if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code)) {
    return new DataError('Il database non ha ancora questa parte: esegui supabase/schema.sql aggiornato nel SQL Editor.', error);
  }
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
        // null (non []) quando la funzione SQL è quella vecchia, senza
        // dress code: la pagina tiene il testo statico invece di svuotarlo.
        dressCode: data?.dress_code ? data.dress_code.map(toDressCodeItem) : null,
        // Stessa logica: senza queste chiavi la pagina resta com'è nel
        // markup, con le sezioni nell'ordine scritto a mano.
        sections: data?.sezioni ? data.sezioni.map(toSectionItem) : null,
        gallery: data?.galleria ? data.galleria.map(toPhotoItem) : null,
        settings: data?.impostazioni ?? {},
      };
    },

    async submitRsvp(rawCode, payload) {
      const { data, error } = await db.rpc('conferma_invito', {
        p_codice: normalizeCode(rawCode),
        p_risposta: {
          ospiti: payload.guests.map((guest) => ({ id: guest.id, stato: guest.status, dieta: guest.diet || null })),
          messaggio: payload.message || null,
          canzone: payload.song || null,
          esigenze: payload.specialNeeds || null,
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

    async reorderInfo(orderedIds) {
      const { error } = await db.rpc('riordina_info_utili', { p_ids: orderedIds });
      guard(error, 'Non riusciamo a salvare il nuovo ordine.');
    },

    /* ---------------- dress code ---------------- */

    async listDressCode() {
      const { data, error } = await db.from('dress_code').select('*').order('posizione');
      guard(error, 'Non riusciamo a caricare il dress code.');
      return (data ?? []).map(toDressCodeItem);
    },

    async saveDressCodeItem(item) {
      const payload = fromDressCodeItem(item);

      if (item.id) {
        const { data, error } = await db.from('dress_code').update(payload).eq('id', item.id).select().single();
        guard(error, 'Non riusciamo a salvare la voce.');
        return toDressCodeItem(data);
      }

      const { data, error } = await db.from('dress_code').insert(payload).select().single();
      guard(error, 'Non riusciamo ad aggiungere la voce.');
      return toDressCodeItem(data);
    },

    async deleteDressCodeItem(id) {
      const { error } = await db.from('dress_code').delete().eq('id', id);
      guard(error, 'Non riusciamo a eliminare la voce.');
    },

    async reorderDressCode(orderedIds) {
      const { error } = await db.rpc('riordina_dress_code', { p_ids: orderedIds });
      guard(error, 'Non riusciamo a salvare il nuovo ordine.');
    },

    /* ---------------- sezioni della pagina ---------------- */

    async listSections() {
      const { data, error } = await db.from('sezioni').select('*').order('posizione');
      guard(error, 'Non riusciamo a caricare le sezioni.');
      return (data ?? []).map(toSectionItem);
    },

    /** Si tocca solo la visibilità: le sezioni esistono nel markup, non qui. */
    async saveSection(section) {
      const { data, error } = await db
        .from('sezioni')
        .update({ pubblicato: section.published !== false })
        .eq('chiave', section.key)
        .select()
        .single();
      guard(error, 'Non riusciamo a salvare la sezione.');
      return toSectionItem(data);
    },

    async reorderSections(orderedKeys) {
      const { error } = await db.rpc('riordina_sezioni', { p_chiavi: orderedKeys });
      guard(error, 'Non riusciamo a salvare il nuovo ordine.');
    },

    /* ---------------- galleria ---------------- */

    async listGallery() {
      const { data, error } = await db.from('galleria').select('*').order('posizione');
      guard(error, 'Non riusciamo a caricare le foto.');
      return (data ?? []).map(toPhotoItem);
    },

    async saveGalleryItem(item) {
      const payload = fromPhotoItem(item);

      if (item.id) {
        const { data, error } = await db.from('galleria').update(payload).eq('id', item.id).select().single();
        guard(error, 'Non riusciamo a salvare la foto.');
        return toPhotoItem(data);
      }

      const { data, error } = await db.from('galleria').insert(payload).select().single();
      guard(error, 'Non riusciamo ad aggiungere la foto.');
      return toPhotoItem(data);
    },

    async deleteGalleryItem(id) {
      const { error } = await db.from('galleria').delete().eq('id', id);
      guard(error, 'Non riusciamo a togliere la foto.');
    },

    async reorderGallery(orderedIds) {
      const { error } = await db.rpc('riordina_galleria', { p_ids: orderedIds });
      guard(error, 'Non riusciamo a salvare il nuovo ordine.');
    },

    /* ---------------- impostazioni ---------------- */

    async getSettings() {
      const { data, error } = await db.from('impostazioni').select('*');
      guard(error, 'Non riusciamo a caricare le impostazioni.');
      return Object.fromEntries((data ?? []).map((row) => [row.chiave, row.valore ?? '']));
    },

    async saveSetting(key, value) {
      const { error } = await db
        .from('impostazioni')
        .upsert({ chiave: key, valore: value || null }, { onConflict: 'chiave' });
      guard(error, 'Non riusciamo a salvare l’impostazione.');
    },
  };
}
