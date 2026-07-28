begin;

drop policy if exists study_rooms_read_members on public.study_rooms;
drop policy if exists study_rooms_read_authenticated on public.study_rooms;
create policy study_rooms_read_authenticated
on public.study_rooms
for select
to authenticated
using (true);

drop policy if exists study_members_read_members on public.study_members;
drop policy if exists study_members_read_authenticated on public.study_members;
create policy study_members_read_authenticated
on public.study_members
for select
to authenticated
using (true);

commit;
