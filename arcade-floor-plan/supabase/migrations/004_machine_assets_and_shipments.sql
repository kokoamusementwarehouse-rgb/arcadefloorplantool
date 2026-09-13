-- Phase 8: physical machine asset management and inbound shipments.
-- This migration is additive. Existing floor-plan and transfer data is unchanged.

alter table public.venue_machines
  add column if not exists condition text not null default 'USED'
    check (condition in ('NEW', 'USED')),
  add column if not exists for_sale boolean not null default false,
  add column if not exists maintenance_status text not null default 'OK'
    check (maintenance_status in ('OK', 'NEEDS_REPAIR', 'WAITING_PARTS', 'UNDER_REPAIR')),
  add column if not exists maintenance_note text,
  add column if not exists missing_parts jsonb not null default '[]'::jsonb,
  add column if not exists received_at timestamptz;

create table if not exists public.shipments (
  id text primary key,
  shipment_ref text,
  expected_arrival_date date,
  status text not null default 'ORDERED'
    check (status in ('ORDERED', 'IN_PRODUCTION', 'IN_SHIPMENT', 'ARRIVED', 'CLOSED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipment_items (
  id text primary key,
  shipment_id text not null references public.shipments(id) on delete cascade,
  venue_machine_id text not null unique references public.venue_machines(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists shipment_items_shipment_id_idx on public.shipment_items(shipment_id);
create index if not exists venue_machines_for_sale_idx on public.venue_machines(for_sale);
create index if not exists venue_machines_maintenance_status_idx on public.venue_machines(maintenance_status);

alter table public.shipments enable row level security;
alter table public.shipment_items enable row level security;

drop policy if exists pilot_anon_read on public.shipments;
drop policy if exists pilot_anon_write on public.shipments;
drop policy if exists pilot_anon_read on public.shipment_items;
drop policy if exists pilot_anon_write on public.shipment_items;
create policy pilot_anon_read on public.shipments for select to anon, authenticated using (true);
create policy pilot_anon_write on public.shipments for all to anon, authenticated using (true) with check (true);
create policy pilot_anon_read on public.shipment_items for select to anon, authenticated using (true);
create policy pilot_anon_write on public.shipment_items for all to anon, authenticated using (true) with check (true);

do $$
declare table_name text;
begin
  foreach table_name in array array['shipments', 'shipment_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
