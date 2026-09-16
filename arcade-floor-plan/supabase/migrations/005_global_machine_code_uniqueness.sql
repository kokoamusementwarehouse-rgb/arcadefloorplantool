-- Machine codes identify physical units across the entire shared workspace.
-- This migration safely repairs legacy duplicates before enforcing the rule.
-- For each duplicate group, the oldest physical-machine record keeps its code;
-- later records receive the next globally unused M-number.

do $$
declare
  duplicate record;
  next_number integer;
  candidate text;
begin
  -- The UI already trims manual input. Normalising legacy whitespace prevents
  -- visually identical values bypassing the case-insensitive unique index.
  update public.venue_machines
  set machine_code = btrim(machine_code)
  where machine_code <> btrim(machine_code);

  select coalesce(max(
    coalesce(nullif(regexp_replace(lower(machine_code), '^m0*', ''), ''), '0')::integer
  ), 0)
  into next_number
  from public.venue_machines
  where lower(machine_code) ~ '^m[0-9]+$';

  for duplicate in
    select id
    from (
      select
        id,
        btrim(machine_code) as machine_code,
        row_number() over (
          partition by lower(btrim(machine_code))
          order by created_at asc nulls last, id asc
        ) as code_rank
      from public.venue_machines
    ) ranked
    where machine_code = '' or code_rank > 1
    order by machine_code, id
  loop
    loop
      next_number := next_number + 1;
      candidate := 'M' || lpad(next_number::text, 2, '0');
      exit when not exists (
        select 1
        from public.venue_machines
        where lower(btrim(machine_code)) = lower(candidate)
           or (
             lower(machine_code) ~ '^m[0-9]+$'
             and coalesce(nullif(regexp_replace(lower(machine_code), '^m0*', ''), ''), '0')::integer = next_number
           )
      );
    end loop;

    update public.venue_machines
    set machine_code = candidate,
        updated_at = now()
    where id = duplicate.id;
  end loop;
end $$;

create unique index if not exists venue_machines_machine_code_global_ci_unique
  on public.venue_machines ((lower(btrim(machine_code))));
