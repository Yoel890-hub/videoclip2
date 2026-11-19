-- Cola de trabajos en la propia base de datos (sustituye a Redis/Docker).
-- Un clip o una búsqueda "queued" es un trabajo pendiente. El worker llama a estas funciones para quedarse
-- con el siguiente: FOR UPDATE SKIP LOCKED garantiza que dos workers nunca cojan el mismo trabajo.

create or replace function public.claim_clip() returns setof public.clips
language plpgsql security definer set search_path = public as $$
begin
  return query
  -- created_at < now() - 3 s: los clips de una grabación de directo los crea el propio worker y los pasa a
  -- "processing" al instante; el margen evita que la cola los coja en ese milisegundo intermedio.
  update clips set status = 'processing', progress = 0, stage = 'Preparando…'
  where id = (select id from clips where status = 'queued' and created_at < now() - interval '3 seconds'
              order by created_at for update skip locked limit 1)
  returning *;
end $$;

create or replace function public.claim_auto_job() returns setof public.auto_jobs
language plpgsql security definer set search_path = public as $$
begin
  return query
  update auto_jobs set status = 'analyzing'
  where id = (select id from auto_jobs where status = 'queued' order by created_at for update skip locked limit 1)
  returning *;
end $$;

-- Solo el worker (con la clave de servidor) puede usarlas.
revoke all on function public.claim_clip() from public, anon, authenticated;
revoke all on function public.claim_auto_job() from public, anon, authenticated;

-- Índices para que buscar el siguiente trabajo sea instantáneo.
create index if not exists clips_queued_idx on clips (created_at) where status = 'queued';
create index if not exists auto_jobs_queued_idx on auto_jobs (created_at) where status = 'queued';
