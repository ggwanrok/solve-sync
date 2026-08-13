-- Enable INSERT events from study_comments for Supabase Realtime subscribers.
-- Safe to run more than once.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'study_comments'
  ) then
    alter publication supabase_realtime add table public.study_comments;
  end if;
end;
$$;
