-- =========================================================
-- PORTAFOLIO ACADÉMICO — ESTRUCTURA DE MATERIALES
-- Supabase / PostgreSQL
-- =========================================================

create table if not exists public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.materials (
    id uuid primary key default gen_random_uuid(),
    course_key text not null check (course_key in ('algoritmos', 'desarrollo')),
    week_number smallint not null check (week_number between 1 and 16),
    name text not null,
    description text,
    material_type text not null default 'archivo',
    file_url text,
    storage_path text,
    external_url text,
    file_size bigint,
    mime_type text,
    sort_order integer not null default 0,
    published boolean not null default true,
    created_by uuid not null references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint material_source_check check (
        (storage_path is not null) or (external_url is not null)
    )
);

create index if not exists materials_course_week_idx
    on public.materials(course_key, week_number, sort_order, created_at);

create or replace function public.is_portfolio_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.admin_users
        where user_id = auth.uid()
    );
$$;

alter table public.admin_users enable row level security;
alter table public.materials enable row level security;

-- Nadie puede consultar la tabla de administradores desde el navegador.
drop policy if exists "admins_select_own" on public.admin_users;
create policy "admins_select_own"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

-- Visitantes pueden leer únicamente materiales publicados.
drop policy if exists "public_read_published_materials" on public.materials;
create policy "public_read_published_materials"
on public.materials for select
to anon, authenticated
using (published = true);

-- Solo los administradores pueden crear, editar y eliminar.
drop policy if exists "admins_insert_materials" on public.materials;
create policy "admins_insert_materials"
on public.materials for insert
to authenticated
with check (public.is_portfolio_admin() and created_by = auth.uid());

drop policy if exists "admins_update_materials" on public.materials;
create policy "admins_update_materials"
on public.materials for update
to authenticated
using (public.is_portfolio_admin())
with check (public.is_portfolio_admin());

drop policy if exists "admins_delete_materials" on public.materials;
create policy "admins_delete_materials"
on public.materials for delete
to authenticated
using (public.is_portfolio_admin());

-- =========================================================
-- STORAGE
-- Bucket público: los visitantes necesitan poder visualizar/descargar los archivos.
insert into storage.buckets (id, name, public)
values ('materiales', 'materiales', true)
on conflict (id) do update set public = true;

drop policy if exists "public_read_material_files" on storage.objects;
create policy "public_read_material_files"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'materiales');

drop policy if exists "admins_upload_material_files" on storage.objects;
create policy "admins_upload_material_files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'materiales' and public.is_portfolio_admin());

drop policy if exists "admins_update_material_files" on storage.objects;
create policy "admins_update_material_files"
on storage.objects for update
to authenticated
using (bucket_id = 'materiales' and public.is_portfolio_admin())
with check (bucket_id = 'materiales' and public.is_portfolio_admin());

drop policy if exists "admins_delete_material_files" on storage.objects;
create policy "admins_delete_material_files"
on storage.objects for delete
to authenticated
using (bucket_id = 'materiales' and public.is_portfolio_admin());
