-- Enable push and in-app notifications for @nickname mentions in the study lounge.
begin;

alter table public.study_notifications
  drop constraint if exists study_notifications_type_check;
alter table public.study_notifications
  add constraint study_notifications_type_check
  check (type in ('goal_reminder', 'goal_missed', 'weekly_summary', 'period_summary', 'poke', 'mention'));

commit;
