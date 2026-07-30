-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- Stores activity history for Design App (YouTube GIF, stock, AI video, upscale, uploads)

create table if not exists public.history_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  type text not null,
  status text not null default 'processing',
  title text not null,
  description text,
  input_summary text,
  job_id text,
  result_url text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists history_logs_created_at_idx on public.history_logs (created_at desc);
create index if not exists history_logs_job_id_idx on public.history_logs (job_id);
create index if not exists history_logs_type_idx on public.history_logs (type);

alter table public.history_logs enable row level security;

create policy "history_logs_select_anon"
  on public.history_logs for select
  to anon, authenticated
  using (true);

create policy "history_logs_insert_anon"
  on public.history_logs for insert
  to anon, authenticated
  with check (true);

create policy "history_logs_update_anon"
  on public.history_logs for update
  to anon, authenticated
  using (true)
  with check (true);
