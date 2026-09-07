-- Shared cloud persistence for the Arcade Floor Plan pilot.
-- RLS is enabled on every table. The temporary pilot policies are intentionally
-- explicit and should be replaced with authenticated workspace policies before
-- external/public use.
create table if not exists public.venues (
  id text primary key, name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.catalog_machines (
  id text primary key, name text not null, category text not null, image_url text, width_mm numeric not null, depth_mm numeric not null, height_mm numeric, model text, notes text, footprint_color text, footprint_text_color text, created_at timestamptz not null, updated_at timestamptz not null
);
create table if not exists public.venue_machines (
  id text primary key, venue_id text references public.venues(id) on delete cascade, machine_id text not null references public.catalog_machines(id) on delete restrict, machine_code text not null, use_custom_dimensions boolean not null default false, custom_width_mm numeric, custom_depth_mm numeric, status text not null default 'planned', transferred_at timestamptz, created_at timestamptz not null, updated_at timestamptz not null
);
create table if not exists public.floor_plans (
  id text primary key, venue_id text not null unique references public.venues(id) on delete cascade, image_url text, image_width_px integer not null default 0, image_height_px integer not null default 0, scale_mm_per_px numeric, background_offset_x numeric, background_offset_y numeric, created_at timestamptz not null, updated_at timestamptz not null
);
create table if not exists public.layouts (
  id text primary key, venue_id text not null references public.venues(id) on delete cascade, floor_plan_id text references public.floor_plans(id) on delete cascade, name text not null, created_at timestamptz not null, updated_at timestamptz not null
);
create table if not exists public.layout_machines (
  id text primary key, layout_id text not null references public.layouts(id) on delete cascade, venue_machine_id text not null unique references public.venue_machines(id) on delete cascade, x_mm numeric not null, y_mm numeric not null, rotation numeric not null default 0
);
create table if not exists public.transfer_buffers (
  id text primary key, name text not null, destination_venue_id text references public.venues(id) on delete set null, created_at timestamptz not null, updated_at timestamptz not null
);
create table if not exists public.transfer_buffer_items (
  id text primary key, transfer_buffer_id text not null references public.transfer_buffers(id) on delete cascade, venue_machine_id text not null unique references public.venue_machines(id) on delete cascade, source_venue_id text references public.venues(id) on delete set null, added_at timestamptz not null, item_order integer not null
);
alter table public.venues enable row level security;
alter table public.catalog_machines enable row level security;
alter table public.venue_machines enable row level security;
alter table public.floor_plans enable row level security;
alter table public.layouts enable row level security;
alter table public.layout_machines enable row level security;
alter table public.transfer_buffers enable row level security;
alter table public.transfer_buffer_items enable row level security;
-- Temporary internal-pilot access only. Replace with workspace membership policies.
do $$ declare t text; begin foreach t in array array['venues','catalog_machines','venue_machines','floor_plans','layouts','layout_machines','transfer_buffers','transfer_buffer_items'] loop execute format('drop policy if exists pilot_anon_read on public.%I', t); execute format('drop policy if exists pilot_anon_write on public.%I', t); execute format('create policy pilot_anon_read on public.%I for select to anon, authenticated using (true)', t); execute format('create policy pilot_anon_write on public.%I for all to anon, authenticated using (true) with check (true)', t); end loop; end $$;
insert into storage.buckets (id, name, public) values ('machine-images','machine-images', true), ('floor-plans','floor-plans', true) on conflict (id) do nothing;
drop policy if exists pilot_machine_images_read on storage.objects;
drop policy if exists pilot_machine_images_write on storage.objects;
drop policy if exists pilot_floor_plans_read on storage.objects;
drop policy if exists pilot_floor_plans_write on storage.objects;
create policy pilot_machine_images_read on storage.objects for select to anon, authenticated using (bucket_id = 'machine-images');
create policy pilot_machine_images_write on storage.objects for insert to anon, authenticated with check (bucket_id = 'machine-images');
create policy pilot_floor_plans_read on storage.objects for select to anon, authenticated using (bucket_id = 'floor-plans');
create policy pilot_floor_plans_write on storage.objects for insert to anon, authenticated with check (bucket_id = 'floor-plans');
