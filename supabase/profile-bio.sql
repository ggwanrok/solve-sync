begin;

alter table public.profiles add column if not exists bio text not null default '';

alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length check (char_length(bio) <= 40);

grant update(bio) on public.profiles to authenticated;

commit;
