-- Base en la nube para las páginas de MORERO (stock, cotizador y proveedores).
-- Pegar todo en Supabase → SQL Editor → New query → Run. Se ejecuta una sola vez.

create table if not exists public.datos (
  usuario uuid not null default auth.uid() references auth.users (id) on delete cascade,
  app text not null,
  contenido jsonb not null,
  equipo text,
  actualizado timestamptz not null default now(),
  primary key (usuario, app)
);

-- Una copia por día del estado anterior, por si hay que volver atrás.
create table if not exists public.datos_historial (
  id bigserial primary key,
  usuario uuid not null,
  app text not null,
  contenido jsonb not null,
  guardado timestamptz not null default now()
);

alter table public.datos enable row level security;
alter table public.datos_historial enable row level security;

drop policy if exists "solo mis datos" on public.datos;
create policy "solo mis datos" on public.datos for all to authenticated
  using (usuario = auth.uid()) with check (usuario = auth.uid());

drop policy if exists "ver mi historial" on public.datos_historial;
create policy "ver mi historial" on public.datos_historial for select to authenticated
  using (usuario = auth.uid());

create or replace function public.datos_al_guardar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.actualizado := now();
  if tg_op = 'UPDATE' and not exists (
    select 1 from public.datos_historial h
    where h.usuario = old.usuario and h.app = old.app and h.guardado::date = now()::date
  ) then
    insert into public.datos_historial (usuario, app, contenido) values (old.usuario, old.app, old.contenido);
  end if;
  return new;
end $$;

drop trigger if exists datos_al_guardar on public.datos;
create trigger datos_al_guardar before insert or update on public.datos
  for each row execute function public.datos_al_guardar();
