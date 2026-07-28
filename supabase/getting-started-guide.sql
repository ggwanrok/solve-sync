alter table public.profiles
add column if not exists guide_completed_at timestamptz;
