/**
 * Client Supabase, caricato su richiesta.
 * L'import dinamico tiene il bundle fuori dalla landing finché non serve.
 */

import { config } from '../config.js';

// Major bloccata, minor libera: le chiavi `sb_publishable_...` richiedono
// una 2.x recente, e restare sull'ultima della major evita sorprese.
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let clientPromise = null;

export function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = import(CDN).then(({ createClient }) =>
      createClient(config.supabase.url, config.supabase.apiKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'nozze-auth',
        },
      }));
  }
  return clientPromise;
}
