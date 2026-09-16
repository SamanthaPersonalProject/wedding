/**
 * Livello dati: una sola interfaccia, due implementazioni.
 *
 * Il resto dell'applicazione importa SOLO da qui e non sa se sotto ci sia
 * Supabase o il localStorage. Per cambiare backend si tocca un file solo.
 *
 * @typedef {Object} Invite
 * @property {string} id
 * @property {string} code           - codice invito, univoco
 * @property {string} groupName      - "Famiglia Rossi"
 * @property {number} maxSeats
 * @property {string} phone          - per WhatsApp
 * @property {string} adminNote      - nota privata, mai mostrata all'ospite
 * @property {boolean} needsTransport
 * @property {string|null} respondedAt
 * @property {string} message        - due righe lasciate dagli ospiti
 * @property {string} song
 * @property {Guest[]} guests
 *
 * @typedef {Object} Guest
 * @property {string} id
 * @property {string} inviteId
 * @property {string} name
 * @property {boolean} isChild
 * @property {'in_attesa'|'confermato'|'assente'} status
 * @property {string} diet           - allergie o preferenze
 *
 * @typedef {Object} TimelineItem
 * @property {string} id
 * @property {string} time           - "16:30"
 * @property {string} title
 * @property {string} description
 * @property {number} position
 * @property {boolean} published
 *
 * @typedef {Object} InfoItem
 * @property {string} id
 * @property {string} category      - testo libero, deciso dagli sposi
 * @property {string} title
 * @property {string} description
 * @property {string} url
 * @property {number} position
 * @property {boolean} published
 *
 * Metodi attesi da ogni implementazione:
 *
 *   // pubblico (ospiti)
 *   verifyInvite(code)                  -> {invite, timeline, info} | null
 *   submitRsvp(code, payload)           -> Invite
 *   getPublicContent()                  -> {timeline, info}
 *
 *   // riservato (sposi)
 *   signIn(email, password)             -> {email}
 *   signOut()                           -> void
 *   currentUser()                       -> {email} | null
 *   listInvites()                       -> Invite[]
 *   saveInvite(invite)                  -> Invite     (crea se manca l'id)
 *   deleteInvite(id)                    -> void
 *   saveGuest(guest)                    -> Guest
 *   deleteGuest(id)                     -> void
 *   listTimeline()                      -> TimelineItem[]
 *   saveTimelineItem(item)              -> TimelineItem
 *   deleteTimelineItem(id)              -> void
 *   reorderTimeline(orderedIds)         -> void
 *   listInfo()                          -> InfoItem[]
 *   saveInfoItem(item)                  -> InfoItem
 *   deleteInfoItem(id)                  -> void
 */

import { usesSupabase } from '../config.js';

let instance = null;

/** Ritorna il repository attivo (singleton). */
export async function getRepository() {
  if (instance) return instance;

  if (usesSupabase) {
    const { createSupabaseRepository } = await import('./supabase-repo.js');
    instance = await createSupabaseRepository();
  } else {
    const { createMockRepository } = await import('./mock-repo.js');
    instance = createMockRepository();
  }
  return instance;
}

/** true quando stiamo lavorando su dati finti nel browser. */
export const isDemoMode = !usesSupabase;

/** Errore applicativo con messaggio già pronto per l'utente. */
export class DataError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'DataError';
    this.cause = cause;
  }
}
