alter table public.messages
add column if not exists user_feedback smallint,
add column if not exists user_feedback_at bigint;

alter table public.messages
drop constraint if exists messages_user_feedback_check;

alter table public.messages
add constraint messages_user_feedback_check
check (user_feedback in (-1, 1) or user_feedback is null);

create index if not exists idx_messages_user_feedback
on public.messages (user_feedback)
where user_feedback is not null;

create index if not exists idx_messages_user_feedback_at
on public.messages (user_feedback_at)
where user_feedback_at is not null;