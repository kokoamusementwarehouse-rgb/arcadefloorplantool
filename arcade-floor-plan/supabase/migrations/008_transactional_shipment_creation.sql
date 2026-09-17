-- Transactional inbound-shipment creation.
-- Additive: it does not alter existing units, codes, layouts, images or shipments.
-- The advisory transaction lock serialises only automatic M-code allocation.

create or replace function public.create_shipment_with_machines(
  p_shipment_id text,
  p_shipment_ref text,
  p_expected_arrival_date date,
  p_status text,
  p_notes text,
  p_lines jsonb
)
returns text
language plpgsql
set search_path = public
as $$
declare
  line jsonb;
  line_number integer := 0;
  unit_number integer;
  next_code integer;
  catalog_id text;
  quantity integer;
  code text;
  timestamp_now timestamptz := now();
begin
  if p_shipment_id is null or btrim(p_shipment_id) = '' then
    raise exception 'Shipment id is required';
  end if;
  if p_status is null or p_status not in ('ORDERED', 'IN_PRODUCTION', 'IN_SHIPMENT', 'ARRIVED', 'CLOSED') then
    raise exception 'Invalid shipment status';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one shipment machine line is required';
  end if;

  -- A transaction-scoped lock makes the MAX-based bootstrap allocator safe
  -- while retaining all existing production codes unchanged.
  perform pg_advisory_xact_lock(80421655);
  select coalesce(max((regexp_match(machine_code, '^M0*([0-9]+)$', 'i'))[1]::integer), 0)
  into next_code
  from public.venue_machines
  where machine_code ~* '^M[0-9]+$';

  insert into public.shipments (id, shipment_ref, expected_arrival_date, status, notes, created_at, updated_at)
  values (p_shipment_id, nullif(btrim(p_shipment_ref), ''), p_expected_arrival_date, p_status, nullif(btrim(p_notes), ''), timestamp_now, timestamp_now);

  for line in select value from jsonb_array_elements(p_lines)
  loop
    line_number := line_number + 1;
    quantity := (line ->> 'quantity')::integer;
    if quantity is null or quantity < 1 then
      raise exception 'Shipment line % must have a positive quantity', line_number;
    end if;

    if line ->> 'mode' = 'existing' then
      catalog_id := nullif(line ->> 'catalogMachineId', '');
      if catalog_id is null or not exists (select 1 from public.catalog_machines where id = catalog_id) then
        raise exception 'Shipment line % references an unavailable catalog model', line_number;
      end if;
    elsif line ->> 'mode' = 'new' then
      catalog_id := nullif(line ->> 'catalogMachineId', '');
      if catalog_id is null or nullif(btrim(line ->> 'name'), '') is null or nullif(btrim(line ->> 'category'), '') is null
        or coalesce((line ->> 'widthMm')::numeric, 0) <= 0 or coalesce((line ->> 'depthMm')::numeric, 0) <= 0 then
        raise exception 'Shipment line % has incomplete new catalog details', line_number;
      end if;
      insert into public.catalog_machines (id, name, category, image_url, width_mm, depth_mm, height_mm, created_at, updated_at)
      values (
        catalog_id,
        btrim(line ->> 'name'),
        btrim(line ->> 'category'),
        nullif(line ->> 'imageUrl', ''),
        (line ->> 'widthMm')::numeric,
        (line ->> 'depthMm')::numeric,
        nullif(line ->> 'heightMm', '')::numeric,
        timestamp_now,
        timestamp_now
      );
    else
      raise exception 'Shipment line % must use an existing or new catalog model', line_number;
    end if;

    for unit_number in 1..quantity
    loop
      next_code := next_code + 1;
      code := 'M' || lpad(next_code::text, 3, '0');
      insert into public.venue_machines (
        id, venue_id, machine_id, machine_code,
        use_custom_dimensions, custom_width_mm, custom_depth_mm,
        status, transferred_at, condition, for_sale, maintenance_status,
        maintenance_note, missing_parts, received_at, created_at, updated_at
      ) values (
        p_shipment_id || '__unit_' || line_number || '_' || unit_number,
        null, catalog_id, code,
        false, null, null,
        'planned', null, 'NEW', false, 'OK',
        null, '[]'::jsonb, null, timestamp_now, timestamp_now
      );
      insert into public.shipment_items (id, shipment_id, venue_machine_id, created_at)
      values (
        p_shipment_id || '__item_' || line_number || '_' || unit_number,
        p_shipment_id,
        p_shipment_id || '__unit_' || line_number || '_' || unit_number,
        timestamp_now
      );
    end loop;
  end loop;

  return p_shipment_id;
end;
$$;

-- Keep the RPC callable only by the two frontend roles used by this pilot.
revoke all on function public.create_shipment_with_machines(text, text, date, text, text, jsonb) from public;
grant execute on function public.create_shipment_with_machines(text, text, date, text, text, jsonb) to anon, authenticated;

-- Copying an existing physical unit is also an automatic-code operation.
-- Keeping it in the same locked allocator prevents browser snapshots from
-- racing each other or violating the global code index.
create or replace function public.copy_venue_machine_with_next_code(
  p_source_id text,
  p_copy_id text
)
returns text
language plpgsql
set search_path = public
as $$
declare
  source_unit public.venue_machines%rowtype;
  next_code integer;
  timestamp_now timestamptz := now();
begin
  if p_source_id is null or btrim(p_source_id) = '' or p_copy_id is null or btrim(p_copy_id) = '' then
    raise exception 'Source and copy ids are required';
  end if;

  perform pg_advisory_xact_lock(80421655);
  select * into source_unit from public.venue_machines where id = p_source_id;
  if not found then
    raise exception 'Source machine is unavailable';
  end if;

  select coalesce(max((regexp_match(machine_code, '^M0*([0-9]+)$', 'i'))[1]::integer), 0)
  into next_code
  from public.venue_machines
  where machine_code ~* '^M[0-9]+$';

  insert into public.venue_machines (
    id, venue_id, machine_id, machine_code,
    use_custom_dimensions, custom_width_mm, custom_depth_mm,
    status, transferred_at, condition, for_sale, maintenance_status,
    maintenance_note, missing_parts, received_at, created_at, updated_at
  ) values (
    p_copy_id, source_unit.venue_id, source_unit.machine_id,
    'M' || lpad((next_code + 1)::text, 3, '0'),
    source_unit.use_custom_dimensions, source_unit.custom_width_mm, source_unit.custom_depth_mm,
    'planned', null, source_unit.condition, false, 'OK',
    null, '[]'::jsonb, null, timestamp_now, timestamp_now
  );
  return p_copy_id;
end;
$$;

revoke all on function public.copy_venue_machine_with_next_code(text, text) from public;
grant execute on function public.copy_venue_machine_with_next_code(text, text) to anon, authenticated;

-- Floor Plan "Add machine" and "Save & Add" use this command.  An omitted
-- code is allocated only inside the same lock used by shipment and copy.
-- A supplied code is intentionally preserved and the global unique index is
-- still the final authority for a concurrent manual-code collision.
create or replace function public.create_venue_machine_with_code(
  p_id text,
  p_venue_id text,
  p_machine_id text,
  p_machine_code text,
  p_use_custom_dimensions boolean,
  p_custom_width_mm numeric,
  p_custom_depth_mm numeric,
  p_condition text
)
returns table (id text, machine_code text)
language plpgsql
set search_path = public
as $$
declare
  next_code integer;
  assigned_code text;
  timestamp_now timestamptz := now();
begin
  if p_id is null or btrim(p_id) = '' or p_venue_id is null or btrim(p_venue_id) = '' or p_machine_id is null or btrim(p_machine_id) = '' then
    raise exception 'Machine id, venue id and catalog model id are required';
  end if;
  if p_condition is null or p_condition not in ('NEW', 'USED') then
    raise exception 'Invalid machine condition';
  end if;

  if nullif(btrim(p_machine_code), '') is null then
    perform pg_advisory_xact_lock(80421655);
    select coalesce(max((regexp_match(vm.machine_code, '^M0*([0-9]+)$', 'i'))[1]::integer), 0)
    into next_code
    from public.venue_machines as vm
    where vm.machine_code ~* '^M[0-9]+$';
    assigned_code := 'M' || lpad((next_code + 1)::text, 3, '0');
  else
    assigned_code := btrim(p_machine_code);
  end if;

  insert into public.venue_machines (
    id, venue_id, machine_id, machine_code,
    use_custom_dimensions, custom_width_mm, custom_depth_mm,
    status, transferred_at, condition, for_sale, maintenance_status,
    maintenance_note, missing_parts, received_at, created_at, updated_at
  ) values (
    p_id, p_venue_id, p_machine_id, assigned_code,
    coalesce(p_use_custom_dimensions, false), p_custom_width_mm, p_custom_depth_mm,
    'planned', null, p_condition, false, 'OK',
    null, '[]'::jsonb, null, timestamp_now, timestamp_now
  );

  return query select p_id, assigned_code;
end;
$$;

revoke all on function public.create_venue_machine_with_code(text, text, text, text, boolean, numeric, numeric, text) from public;
grant execute on function public.create_venue_machine_with_code(text, text, text, text, boolean, numeric, numeric, text) to anon, authenticated;

-- New-model image uploads happen before the RPC.  If the transaction rejects
-- the line, the frontend removes only that freshly-uploaded object.  The
-- existing insert policy is retained; this is the narrowly required cleanup
-- permission for the same public pilot bucket.
drop policy if exists pilot_machine_images_delete on storage.objects;
create policy pilot_machine_images_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'machine-images');
