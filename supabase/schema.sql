-- =============================================================
--  Nozze — schema Supabase
--  Eseguire per intero nel SQL Editor di Supabase (una volta sola).
--
--  Modello di sicurezza
--  --------------------
--  * RLS attiva ovunque, nessuna policy per il ruolo `anon`:
--    con la sola chiave pubblica non si legge né si scrive nulla.
--  * Gli sposi (utenti autenticati) hanno accesso completo.
--  * Gli ospiti passano da tre funzioni SECURITY DEFINER, che
--    restituiscono esclusivamente il gruppo legato al loro codice.
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
--  Tabelle
-- ---------------------------------------------------------------

create table if not exists public.inviti (
  id          uuid primary key default gen_random_uuid(),
  codice      text not null unique,
  nome_gruppo text not null,
  posti_max   integer not null default 1 check (posti_max between 1 and 12),
  telefono    text,
  nota_admin  text,                       -- privata: mai esposta agli ospiti
  navetta     boolean not null default false,
  messaggio   text,
  canzone     text,
  risposto_il timestamptz,
  creato_il   timestamptz not null default now()
);

comment on column public.inviti.nota_admin is 'Nota privata degli sposi. Le funzioni per gli ospiti non la restituiscono mai.';

create table if not exists public.ospiti (
  id        uuid primary key default gen_random_uuid(),
  invito_id uuid not null references public.inviti(id) on delete cascade,
  nome      text not null,
  bambino   boolean not null default false,
  stato     text not null default 'in_attesa'
            check (stato in ('in_attesa', 'confermato', 'assente')),
  dieta     text,
  creato_il timestamptz not null default now()
);

create index if not exists ospiti_invito_id_idx on public.ospiti (invito_id);

create table if not exists public.programma (
  id          uuid primary key default gen_random_uuid(),
  ora         time not null,
  titolo      text not null,
  descrizione text,
  posizione   integer not null default 999,
  pubblicato  boolean not null default true
);

create index if not exists programma_posizione_idx on public.programma (posizione);

-- Le categorie sono testo libero: le decidono gli sposi dal portale.
-- Niente lista chiusa, così se domani serve "Parrucchiere" o "Bambini"
-- si scrive e basta, senza toccare il database.
create table if not exists public.info_utili (
  id          uuid primary key default gen_random_uuid(),
  categoria   text not null default 'Buono a sapersi',
  titolo      text not null,
  descrizione text,
  url         text,
  posizione   integer not null default 999,
  pubblicato  boolean not null default true
);

-- Migrazione dalla prima versione dello schema (colonna `tipo` a lista chiusa).
-- Deve stare PRIMA degli indici: su un database già creato la colonna si
-- chiama ancora `tipo`, e un indice su `categoria` fallirebbe.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'info_utili' and column_name = 'tipo'
  ) then
    alter table public.info_utili drop constraint if exists info_utili_tipo_check;
    alter table public.info_utili rename column tipo to categoria;
    alter table public.info_utili alter column categoria set default 'Buono a sapersi';

    update public.info_utili set categoria = case categoria
      when 'trasporto' then 'Trasporto'
      when 'hotel'     then 'Dove dormire'
      when 'generale'  then 'Buono a sapersi'
      else categoria
    end;
  end if;
end $$;

create index if not exists info_utili_posizione_idx on public.info_utili (posizione);
create index if not exists info_utili_categoria_idx on public.info_utili (categoria);

-- Traccia dei tentativi di codice: serve a bloccare chi prova a indovinare.
create table if not exists public.tentativi_codice (
  id        bigserial primary key,
  codice    text not null,
  esito     boolean not null,
  quando    timestamptz not null default now()
);

create index if not exists tentativi_codice_quando_idx on public.tentativi_codice (quando desc);

-- ---------------------------------------------------------------
--  Row Level Security
-- ---------------------------------------------------------------

alter table public.inviti            enable row level security;
alter table public.ospiti            enable row level security;
alter table public.programma         enable row level security;
alter table public.info_utili        enable row level security;
alter table public.tentativi_codice  enable row level security;

-- Gli sposi: accesso pieno. Gli anonimi: nessuna policy, quindi nulla.
drop policy if exists "sposi gestiscono inviti" on public.inviti;
create policy "sposi gestiscono inviti" on public.inviti
  for all to authenticated using (true) with check (true);

drop policy if exists "sposi gestiscono ospiti" on public.ospiti;
create policy "sposi gestiscono ospiti" on public.ospiti
  for all to authenticated using (true) with check (true);

drop policy if exists "sposi gestiscono programma" on public.programma;
create policy "sposi gestiscono programma" on public.programma
  for all to authenticated using (true) with check (true);

drop policy if exists "sposi gestiscono info" on public.info_utili;
create policy "sposi gestiscono info" on public.info_utili
  for all to authenticated using (true) with check (true);

drop policy if exists "sposi leggono tentativi" on public.tentativi_codice;
create policy "sposi leggono tentativi" on public.tentativi_codice
  for select to authenticated using (true);

-- ---------------------------------------------------------------
--  Funzioni per gli ospiti (SECURITY DEFINER)
-- ---------------------------------------------------------------

-- Normalizza quello che l'ospite digita: spazi, minuscole, caratteri strani.
create or replace function public.normalizza_codice(p_codice text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_codice, ''), '[^A-Za-z0-9-]', '', 'g'));
$$;

-- Quanti tentativi falliti nell'ultimo quarto d'ora (freno agli indovinelli).
create or replace function public.troppi_tentativi()
returns boolean
language sql
security definer
set search_path = public
as $$
  select count(*) >= 30
  from public.tentativi_codice
  where esito = false
    and quando > now() - interval '15 minutes';
$$;

-- Verifica il codice e restituisce SOLO quel gruppo, più i contenuti pubblici.
create or replace function public.verifica_invito(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codice  text := public.normalizza_codice(p_codice);
  v_invito  public.inviti%rowtype;
  v_trovato boolean;
  v_result  jsonb;
begin
  if public.troppi_tentativi() then
    raise exception 'Troppi tentativi. Riprova tra qualche minuto.'
      using errcode = 'P0001';
  end if;

  select * into v_invito from public.inviti where codice = v_codice;

  -- FOUND va letta subito: l'INSERT qui sotto la sovrascrive.
  v_trovato := found;
  insert into public.tentativi_codice (codice, esito) values (v_codice, v_trovato);

  if not v_trovato then
    return null;
  end if;

  select jsonb_build_object(
    'invito', jsonb_build_object(
      'id',          v_invito.id,
      'codice',      v_invito.codice,
      'nome_gruppo', v_invito.nome_gruppo,
      'posti_max',   v_invito.posti_max,
      'navetta',     v_invito.navetta,
      'messaggio',   v_invito.messaggio,
      'canzone',     v_invito.canzone,
      'risposto_il', v_invito.risposto_il
      -- nota_admin e telefono restano fuori di proposito
    ),
    'ospiti', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'invito_id', o.invito_id, 'nome', o.nome,
               'bambino', o.bambino, 'stato', o.stato, 'dieta', o.dieta
             ) order by o.bambino, o.creato_il)
      from public.ospiti o where o.invito_id = v_invito.id
    ), '[]'::jsonb),
    'programma', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.posizione)
      from public.programma p where p.pubblicato
    ), '[]'::jsonb),
    'info', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.posizione)
      from public.info_utili i where i.pubblicato
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- Programma e info visibili a chiunque, senza codice.
create or replace function public.contenuti_pubblici()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'programma', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.posizione)
      from public.programma p where p.pubblicato
    ), '[]'::jsonb),
    'info', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.posizione)
      from public.info_utili i where i.pubblicato
    ), '[]'::jsonb)
  );
$$;

-- Salva la risposta. Aggiorna solo gli ospiti che appartengono a quel codice.
create or replace function public.conferma_invito(p_codice text, p_risposta jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codice text := public.normalizza_codice(p_codice);
  v_invito public.inviti%rowtype;
begin
  select * into v_invito from public.inviti where codice = v_codice;
  if not found then
    return null;
  end if;

  update public.ospiti o
     set stato = coalesce(r.stato, o.stato),
         dieta = r.dieta
    from jsonb_to_recordset(coalesce(p_risposta -> 'ospiti', '[]'::jsonb))
         as r(id uuid, stato text, dieta text)
   where o.id = r.id
     and o.invito_id = v_invito.id          -- nessuno tocca gli ospiti altrui
     and r.stato in ('in_attesa', 'confermato', 'assente');

  update public.inviti
     set navetta     = coalesce((p_risposta ->> 'navetta')::boolean, navetta),
         messaggio   = nullif(p_risposta ->> 'messaggio', ''),
         canzone     = nullif(p_risposta ->> 'canzone', ''),
         risposto_il = now()
   where id = v_invito.id
  returning * into v_invito;

  return jsonb_build_object(
    'invito', jsonb_build_object(
      'id',          v_invito.id,
      'codice',      v_invito.codice,
      'nome_gruppo', v_invito.nome_gruppo,
      'posti_max',   v_invito.posti_max,
      'navetta',     v_invito.navetta,
      'messaggio',   v_invito.messaggio,
      'canzone',     v_invito.canzone,
      'risposto_il', v_invito.risposto_il
    ),
    'ospiti', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'invito_id', o.invito_id, 'nome', o.nome,
               'bambino', o.bambino, 'stato', o.stato, 'dieta', o.dieta
             ) order by o.bambino, o.creato_il)
      from public.ospiti o where o.invito_id = v_invito.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Riordino del programma in un colpo solo (usato dal drag & drop).
create or replace function public.riordina_programma(p_ids uuid[])
returns void
language plpgsql
security invoker                            -- passa da RLS: solo gli sposi
as $$
begin
  update public.programma p
     set posizione = sub.ord
    from (select unnest(p_ids) as id, generate_subscripts(p_ids, 1) as ord) sub
   where p.id = sub.id;
end;
$$;

-- ---------------------------------------------------------------
--  Permessi di esecuzione
-- ---------------------------------------------------------------

revoke all on function public.verifica_invito(text)          from public;
revoke all on function public.conferma_invito(text, jsonb)   from public;
revoke all on function public.contenuti_pubblici()           from public;
revoke all on function public.riordina_programma(uuid[])     from public;

grant execute on function public.verifica_invito(text)        to anon, authenticated;
grant execute on function public.conferma_invito(text, jsonb) to anon, authenticated;
grant execute on function public.contenuti_pubblici()         to anon, authenticated;
grant execute on function public.riordina_programma(uuid[])   to authenticated;
