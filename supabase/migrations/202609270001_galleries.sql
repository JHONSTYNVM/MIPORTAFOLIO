-- Ejecutar este archivo completo en el SQL Editor del proyecto Supabase existente.
-- Requiere materials, admin_users e is_portfolio_admin() del esquema actual.
-- No elimina materiales ni archivos. Es seguro volver a ejecutarlo.
begin;

create table if not exists public.galleries (
    id uuid primary key default gen_random_uuid(),
    course_key text not null check (course_key in ('algoritmos', 'desarrollo')),
    week_number smallint not null check (week_number between 1 and 16),
    name text not null check (char_length(btrim(name)) between 1 and 120),
    description text check (description is null or char_length(description) <= 2000),
    sort_order integer not null default 0,
    created_by uuid not null references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.materials add column if not exists gallery_id uuid;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.materials'::regclass
          and conname = 'materials_gallery_id_fkey'
    ) then
        alter table public.materials
            add constraint materials_gallery_id_fkey
            foreign key (gallery_id) references public.galleries(id)
            on delete set null;
    end if;
end;
$$;

create index if not exists galleries_course_week_order_idx
    on public.galleries(course_key, week_number, sort_order, created_at);
create index if not exists materials_gallery_id_idx on public.materials(gallery_id);

-- Una galería conserva su curso/semana. Solo se editan sus datos de presentación.
create or replace function public.portfolio_gallery_before_update()
returns trigger language plpgsql set search_path = public as $$
begin
    if new.course_key is distinct from old.course_key
       or new.week_number is distinct from old.week_number then
        raise exception 'No se puede cambiar el curso o la semana de una galería existente.';
    end if;
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists portfolio_gallery_before_update on public.galleries;
create trigger portfolio_gallery_before_update
before update on public.galleries
for each row execute function public.portfolio_gallery_before_update();

-- Impide asignar materiales a una galería de otro curso o semana, también por API.
create or replace function public.portfolio_validate_material_gallery()
returns trigger language plpgsql set search_path = public as $$
begin
    if new.gallery_id is not null and not exists (
        select 1 from public.galleries g
        where g.id = new.gallery_id
          and g.course_key = new.course_key
          and g.week_number = new.week_number
    ) then
        raise exception 'La galería debe pertenecer al mismo curso y semana del material.';
    end if;
    return new;
end;
$$;

drop trigger if exists portfolio_validate_material_gallery on public.materials;
create trigger portfolio_validate_material_gallery
before insert or update of gallery_id, course_key, week_number on public.materials
for each row execute function public.portfolio_validate_material_gallery();

alter table public.galleries enable row level security;
revoke all on public.galleries from anon, authenticated;
grant select on public.galleries to anon, authenticated;
grant insert, update, delete on public.galleries to authenticated;

drop policy if exists public_read_galleries on public.galleries;
create policy public_read_galleries on public.galleries
for select to anon, authenticated using (true);

drop policy if exists admins_insert_galleries on public.galleries;
create policy admins_insert_galleries on public.galleries
for insert to authenticated
with check (public.is_portfolio_admin() and created_by = auth.uid());

drop policy if exists admins_update_galleries on public.galleries;
create policy admins_update_galleries on public.galleries
for update to authenticated
using (public.is_portfolio_admin())
with check (public.is_portfolio_admin());

drop policy if exists admins_delete_galleries on public.galleries;
create policy admins_delete_galleries on public.galleries
for delete to authenticated using (public.is_portfolio_admin());

-- Las políticas existentes de materials siguen protegiendo sus modificaciones.
-- ON DELETE SET NULL desasigna los materiales; no borra sus filas ni toca Storage.
commit;
