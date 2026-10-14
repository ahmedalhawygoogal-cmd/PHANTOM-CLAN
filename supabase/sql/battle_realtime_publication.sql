-- Enable Postgres Changes for existing battle data; this does not create or alter tables.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_matches'
  ) then
    alter publication supabase_realtime add table public.game_matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'popularity_votes'
  ) then
    alter publication supabase_realtime add table public.popularity_votes;
  end if;
end $$;
