-- Machine codes identify physical units across the entire shared workspace.
-- This migration safely repairs legacy duplicates before enforcing the rule.
-- For each duplicate group, the oldest physical-machine record keeps its code;
-- later records receive the next globally unused M-number.

-- The UI already trims manual input. Normalising legacy whitespace prevents
-- visually identical values bypassing the case-insensitive unique index.
update public.venue_machines
set machine_code = btrim(machine_code)
where machine_code <> btrim(machine_code);

with ranked as (
  select
    id,
    btrim(machine_code) as machine_code,
    row_number() over (
      partition by lower(btrim(machine_code))
      order by created_at asc nulls last, id asc
    ) as code_rank
  from public.venue_machines
), max_numeric_code as (
  select coalesce(max(
    coalesce(nullif(regexp_replace(lower(machine_code), '^m0*', ''), ''), '0')::integer
  ), 0) as value
  from public.venue_machines
  where lower(machine_code) ~ '^m[0-9]+$'
), replacements as (
  select
    ranked.id,
    'M' || lpad((max_numeric_code.value + row_number() over (
      order by lower(ranked.machine_code), ranked.id
    ))::text, 2, '0') as machine_code
  from ranked
  cross join max_numeric_code
  where ranked.machine_code = '' or ranked.code_rank > 1
)
update public.venue_machines as unit
set machine_code = replacements.machine_code,
    updated_at = now()
from replacements
where unit.id = replacements.id;

create unique index if not exists venue_machines_machine_code_global_ci_unique
  on public.venue_machines ((lower(btrim(machine_code))));
