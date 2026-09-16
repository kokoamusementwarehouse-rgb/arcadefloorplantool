-- Optional per-venue emoji used only as a visual navigation aid.
alter table public.venues
  add column if not exists icon_emoji text;
