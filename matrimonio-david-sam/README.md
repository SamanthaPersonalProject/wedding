# David & Samantha — sito di nozze

Sito statico con area invitati e portale sposi. Nessun build step, nessuna
dipendenza da installare: sono HTML, CSS e moduli ES. Il database è Supabase,
ma il sito parte e funziona anche senza, in modalità demo.

---

## Come gira in locale

Serve un server HTTP qualsiasi (i moduli ES non si caricano da `file://`):

```bash
cd matrimonio-celtico
python3 -m http.server 8000
# poi apri http://localhost:8000
```

- Sito pubblico: <http://localhost:8000>
- Portale sposi: <http://localhost:8000/admin/>

**In modalità demo** (`js/config.js` senza credenziali) i dati stanno nel
localStorage del browser. Per entrare nel portale: una email qualsiasi e la
password `demo`. Codici invito di prova: `GALWAY-7K2M` (già confermato) e
`BOYNE-4XQP` (in attesa).

---

## Collegare Supabase

1. **Crea il progetto** su [supabase.com](https://supabase.com) (piano gratuito).
2. **Esegui lo schema**: SQL Editor → incolla tutto `supabase/schema.sql` → Run.
3. **Crea l'utente sposi**: Authentication → Users → *Add user* → email e
   password. Disattiva le iscrizioni libere in Authentication → Providers →
   Email → *Allow new users to sign up* = off: gli account li create voi due.
4. **Compila `js/config.js`** con Project URL e chiave `anon` (Project Settings
   → API).

Da quel momento il sito usa il database e la modalità demo sparisce da sola.

### Perché la chiave `anon` può stare nel browser

Non è un segreto: è pensata per il codice pubblico. Quello che protegge i dati
è la Row Level Security:

- RLS attiva su tutte le tabelle e **nessuna policy per il ruolo `anon`** —
  con la sola chiave pubblica non si legge e non si scrive niente.
- Gli ospiti passano da tre funzioni `SECURITY DEFINER`
  (`verifica_invito`, `conferma_invito`, `contenuti_pubblici`) che
  restituiscono **solo** il gruppo corrispondente al codice. Telefono e note
  private non escono mai da lì.
- `conferma_invito` aggiorna un ospite solo se appartiene a quel codice: con
  un codice valido non si tocca il gruppo di qualcun altro.
- I tentativi falliti finiscono in `tentativi_codice`; oltre 30 in un quarto
  d'ora la verifica si blocca, così i codici non si indovinano a forza bruta.

Gli sposi entrano con Supabase Auth e come utenti autenticati hanno accesso
completo alle tabelle.

---

## Come funziona l'invito

1. Nel portale crei un **gruppo** (una famiglia, una coppia, un singolo) e gli
   aggiungi gli **ospiti**. Il codice viene generato in automatico, leggibile
   al telefono: `GALWAY-7K2M`, niente caratteri ambigui (`0/O`, `1/I`, `S/5`).
2. Il bottone **WhatsApp** apre la chat con due righe e il link personale
   `https://…/invito.html?c=CODICE`. Nel messaggio non c'è altro: data, posti
   e codice stanno sulla pagina. Il testo è modificabile prima dell'invio, e
   niente parte da solo.
3. Il link apre **`invito.html`**: la partecipazione vera e propria, con la
   grafica delle nozze, il nome del gruppo, gli ospiti uno per uno, data e
   luogo, i posti tenuti e — in fondo — il **codice invito**.
4. Da lì il bottone porta a `index.html#invito`, dove il codice va digitato.
   Solo allora si aprono programma, informazioni pratiche e conferma di
   presenza. Il codice non viaggia in querystring di proposito: è quello che
   trasforma l'invito in un ingresso.
5. L'ospite risponde per ciascuno e segnala allergie e navetta; la risposta
   compare subito nel portale, con i totali in cima.

> `index.html?c=CODICE` continua a funzionare (sblocca direttamente) per non
> rompere eventuali link già mandati, ma non viene più generato.

---

## Struttura

```
├── index.html              sito pubblico
├── invito.html             invito personale (aperto dal link WhatsApp)
├── admin/index.html        portale sposi
├── assets/                 immagini, favicon
├── css/
│   ├── tokens.css          colori, tipografia, spaziature — l'unica fonte
│   ├── base.css            reset, tipografia, primitive di layout
│   ├── components.css      componenti riusabili (bottoni, tabelle, modali…)
│   ├── landing.css         solo la pagina pubblica
│   ├── invito.css          solo la pagina d'invito
│   └── admin.css           solo il portale
├── js/
│   ├── config.js           credenziali e dati delle nozze
│   ├── lib/                utility DOM, formattazione, client Supabase
│   ├── data/
│   │   ├── repository.js   l'interfaccia + la scelta dell'implementazione
│   │   ├── supabase-repo.js
│   │   └── mock-repo.js    stessa interfaccia, dati in localStorage
│   ├── landing/            countdown, contenuti pubblici, schede, area invito
│   ├── invito/             la pagina d'invito personale
│   └── admin/              invitati, programma, info utili, WhatsApp
└── supabase/schema.sql     tabelle, RLS, funzioni
```

Il resto dell'applicazione importa solo da `js/data/repository.js` e non sa
cosa ci sia sotto. Per cambiare backend si riscrive un file solo.

---

## Prima di pubblicare

- [ ] `js/config.js`: nomi, data, luogo, scadenza RSVP, credenziali Supabase.
- [ ] `config.wedding.siteUrl` con il dominio vero, così i link WhatsApp sono
      corretti anche se qualcuno apre il portale da un indirizzo diverso.
- [ ] Testi della pagina in `index.html` (storia, tartan, dress code, e le
      otto schede della sezione "Le radici": simboli, nove legni, donne e
      guerriere, celti d'Irlanda, di Scozia e d'Italia, pillole irlandesi
      e scozzesi). Le date sono controllate ma qualche cifra è
      convenzionale — il sacco di Roma è 390 o 387 a.C. a seconda della
      fonte. Dove la tradizione è più recente di quanto si creda lo dice
      il testo stesso: l'handfasting "per un anno e un giorno" è un'idea
      di Walter Scott, e la lista dei nove legni è novecentesca anche se
      il fuoco a nove legni è documentato.
- [ ] Immagine di testata in `assets/img/header.jpg` (se la cambi, tieni un
      formato panoramico: al centro deve restare spazio libero per i nomi).
- [ ] Programma e info utili inseriti dal portale, non nel codice. Le
      categorie delle info sono testo libero: le decidi scrivendole, il campo
      propone quelle già usate e c'è "Rinomina categoria" per cambiarle su
      tutte le schede insieme.

Deploy: qualunque hosting statico. Su Netlify o Vercel basta trascinare la
cartella; su GitHub Pages, pubblicare il repository.
