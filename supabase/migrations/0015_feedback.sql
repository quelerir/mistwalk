-- Feedback sent from the app's menu. Read only from the SQL editor or the dashboard; the app never lists it back.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

create policy "Users can send feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);
