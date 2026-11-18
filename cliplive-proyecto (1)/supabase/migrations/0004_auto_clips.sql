-- Clips automáticos: el worker analiza el vídeo o directo, busca los momentos destacados
-- (picos de audio + "lo más visto" de YouTube si existe) y crea varios clips al azar entre ellos.
create table auto_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  platform text not null, source_url text not null,
  source_kind text not null check (source_kind in ('live','vod')),
  count int not null check (count between 1 and 5),
  duration_s int not null,
  window_s int,                       -- directos: segundos que se graban para buscar momentos
  format text not null check (format in ('video','audio')),
  aspect text, quality int,
  cost int not null default 0,        -- créditos por clip (0 en trial)
  is_trial boolean not null default false,
  status text not null default 'queued' check (status in ('queued','analyzing','done','error')),
  error text, clips_created int not null default 0,
  created_at timestamptz not null default now()
);
create index on auto_jobs (user_id, created_at desc);
alter table auto_jobs enable row level security;
create policy "own auto jobs" on auto_jobs for select using (auth.uid() = user_id);

alter table clips add column auto_job_id uuid references auto_jobs(id) on delete set null;
