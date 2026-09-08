-- Enable Realtime events for shared pilot state. This is idempotent.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'venues', 'catalog_machines', 'venue_machines', 'floor_plans',
    'layouts', 'layout_machines', 'transfer_buffers', 'transfer_buffer_items'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
