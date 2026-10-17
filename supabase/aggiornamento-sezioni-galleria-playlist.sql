-- =============================================================
--  Aggiornamento: sezioni riordinabili, galleria, playlist
--
--  Solo le novità. Niente migrazioni, niente ALTER su tabelle che
--  esistono già: sugli inviti, sugli ospiti, sul programma e sulle info
--  questo file non mette le mani. Si può eseguire anche due volte.
--
--  (schema.sql resta il file completo, per ricreare tutto da zero.)
-- =============================================================

-- ---------------------------------------------------------------
--  Tabelle nuove
-- ---------------------------------------------------------------

-- L'ordine delle sezioni della pagina pubblica.
-- `chiave` corrisponde all'attributo data-section nel markup di index.html.
create table if not exists public.sezioni (
  chiave     text primary key,
  etichetta  text not null,
  posizione  integer not null default 999,
  pubblicato boolean not null default true
);

create index if not exists sezioni_posizione_idx on public.sezioni (posizione);

-- Seme: l'ordine con cui le sezioni stanno già in pagina.
-- Solo a tabella vuota, così rieseguire non sovrascrive i tuoi spostamenti.
insert into public.sezioni (chiave, etichetta, posizione)
select * from (values
  ('storia',       'La nostra storia',     1),
  ('programma',    'Il programma',         2),
  ('playlist',     'La playlist',          3),
  ('informazioni', 'Info pratiche',        4),
  ('tartan',       'Tartan e dress code',  5),
  ('radici',       'Le radici celtiche',   6),
  ('invito',       'Conferma di presenza', 7)
) as seme(chiave, etichetta, posizione)
where not exists (select 1 from public.sezioni);

-- Le foto dello slider: qui ci sta solo il riferimento, non il file.
create table if not exists public.galleria (
  id         uuid primary key default gen_random_uuid(),
  url        text not null,
  didascalia text,
  posizione  integer not null default 999,
  pubblicato boolean not null default true
);

create index if not exists galleria_posizione_idx on public.galleria (posizione);

-- Impostazioni libere chiave/valore: per ora il link della playlist.
create table if not exists public.impostazioni (
  chiave text primary key,
  valore text
);

insert into public.impostazioni (chiave, valore)
values ('playlist_spotify', null)
on conflict (chiave) do nothing;

-- ---------------------------------------------------------------
--  Row Level Security sulle tabelle nuove
-- ---------------------------------------------------------------

alter table public.sezioni      enable row level security;
alter table public.galleria     enable row level security;
alter table public.impostazioni enable row level security;

drop policy if exists "sposi gestiscono sezioni" on public.sezioni;
create policy "sposi gestiscono sezioni" on public.sezioni
  for all to authenticated using (true) with check (true);

drop policy if exists "sposi gestiscono galleria" on public.galleria;
create policy "sposi gestiscono galleria" on public.galleria
  for all to authenticated using (true) with check (true);

drop policy if exists "sposi gestiscono impostazioni" on public.impostazioni;
create policy "sposi gestiscono impostazioni" on public.impostazioni
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------
--  Funzioni di riordino nuove
-- ---------------------------------------------------------------

-- Riordino delle info utili. L'ordine delle categorie non ha una tabella
-- sua: una categoria sta dove sta la sua prima scheda.
create or replace function public.riordina_info_utili(p_ids uuid[])
returns void
language plpgsql
security invoker                            -- passa da RLS: solo gli sposi
as $$
begin
  update public.info_utili i
     set posizione = sub.ord
    from (select unnest(p_ids) as id, generate_subscripts(p_ids, 1) as ord) sub
   where i.id = sub.id;
end;
$$;

create or replace function public.riordina_galleria(p_ids uuid[])
returns void
language plpgsql
security invoker
as $$
begin
  update public.galleria g
     set posizione = sub.ord
    from (select unnest(p_ids) as id, generate_subscripts(p_ids, 1) as ord) sub
   where g.id = sub.id;
end;
$$;

-- Qui la chiave è testo, non uuid.
create or replace function public.riordina_sezioni(p_chiavi text[])
returns void
language plpgsql
security invoker
as $$
begin
  update public.sezioni s
     set posizione = sub.ord
    from (select unnest(p_chiavi) as chiave, generate_subscripts(p_chiavi, 1) as ord) sub
   where s.chiave = sub.chiave;
end;
$$;

-- ---------------------------------------------------------------
--  Contenuti pubblici: le tre chiavi nuove
--  Sostituisce la funzione esistente aggiungendo sezioni, galleria e
--  impostazioni. Programma, info e dress code restano identici.
-- ---------------------------------------------------------------

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
    ), '[]'::jsonb),
    'dress_code', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.posizione)
      from public.dress_code d where d.pubblicato
    ), '[]'::jsonb),
    'sezioni', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.posizione)
      from public.sezioni s
    ), '[]'::jsonb),
    'galleria', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.posizione)
      from public.galleria g where g.pubblicato
    ), '[]'::jsonb),
    'impostazioni', coalesce((
      select jsonb_object_agg(i.chiave, i.valore)
      from public.impostazioni i where i.valore is not null
    ), '{}'::jsonb)
  );
$$;

-- ---------------------------------------------------------------
--  Permessi
-- ---------------------------------------------------------------

revoke all on function public.contenuti_pubblici()         from public;
revoke all on function public.riordina_info_utili(uuid[])  from public;
revoke all on function public.riordina_galleria(uuid[])    from public;
revoke all on function public.riordina_sezioni(text[])     from public;

grant execute on function public.contenuti_pubblici()        to anon, authenticated;
grant execute on function public.riordina_info_utili(uuid[]) to authenticated;
grant execute on function public.riordina_galleria(uuid[])   to authenticated;
grant execute on function public.riordina_sezioni(text[])    to authenticated;
