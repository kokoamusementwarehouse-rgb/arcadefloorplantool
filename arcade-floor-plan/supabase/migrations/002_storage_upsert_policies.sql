-- Allow the browser client to replace an existing object.
-- cloudPersistence uploads floor plans and machine images with upsert=true,
-- which performs UPDATE when the object path already exists.
drop policy if exists pilot_machine_images_update on storage.objects;
create policy pilot_machine_images_update
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'machine-images')
  with check (bucket_id = 'machine-images');

drop policy if exists pilot_floor_plans_update on storage.objects;
create policy pilot_floor_plans_update
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'floor-plans')
  with check (bucket_id = 'floor-plans');
