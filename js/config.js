/**
 * Configurazione del sito.
 *
 * Lasciando `supabase.url` vuoto il sito parte in MODALITÀ DEMO: i dati
 * stanno nel localStorage del browser, così si può provare tutto senza
 * backend. Appena compili url + apiKey, passa automaticamente a Supabase.
 *
 * apiKey = chiave PUBBLICA del progetto: `sb_publishable_...` (o la vecchia
 * `anon`, se il progetto usa ancora le chiavi legacy). È pensata per stare
 * nel browser e non è un segreto: la protezione vera è RLS + le funzioni in
 * supabase/schema.sql. La chiave `sb_secret_...` (ex `service_role`) non
 * deve comparire da nessuna parte in questa cartella.
 */
export const config = {
  supabase: {
    url: 'https://exfddwtudwmbjgwmdnrs.supabase.co',
    apiKey: 'sb_publishable_UlT_A1Z1XwbC-PjzdSapEg_2G5-nxi-',
  },

  /** Dati delle nozze: usati da countdown, testi e messaggio WhatsApp. */
  wedding: {
    coupleFirst: 'David',
    coupleSecond: 'Samantha',
    /** ISO con fuso: è l'ora della cerimonia. */
    dateTime: '2027-05-21T16:30:00+02:00',
    venue: 'Lago Bagatol',
    /** Ultimo giorno utile per l'RSVP. */
    rsvpDeadline: '2027-03-21',
    /** Base del link invito: si può lasciare vuoto, viene dedotto. */
    siteUrl: '',
  },
};

/** true quando le credenziali Supabase sono state compilate. */
export const usesSupabase = Boolean(config.supabase.url && config.supabase.apiKey);

/** Base URL del sito, per costruire i link invito. */
export function siteBaseUrl() {
  if (config.wedding.siteUrl) return config.wedding.siteUrl.replace(/\/$/, '');
  const { origin, pathname } = window.location;
  return (origin + pathname.replace(/\/(admin\/)?(index\.html)?$/, '')).replace(/\/$/, '');
}
