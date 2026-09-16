-- Persist the operational type used to organise Floor Plan venues.
alter table public.venues
  add column if not exists venue_type text not null default 'store'
  check (venue_type in ('warehouse', 'store'));

-- Initialise the current workspace deterministically. Future changes are made
-- by the venue-management UI and are stored in this column.
update public.venues
set venue_type = case when lower(name) like '%warehouse%' then 'warehouse' else 'store' end
where venue_type is null or venue_type = 'store';
