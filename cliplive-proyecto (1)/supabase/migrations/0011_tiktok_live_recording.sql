-- Grabación de directos de TikTok: grabaciones largas (hasta 3 h) que sacan más clips (hasta 30).
alter table auto_jobs drop constraint if exists auto_jobs_count_check;
alter table auto_jobs add constraint auto_jobs_count_check check (count between 1 and 30);
-- Cuándo empezó a grabar el worker (para mostrar el progreso de la grabación en la web).
alter table auto_jobs add column if not exists recording_started_at timestamptz;
