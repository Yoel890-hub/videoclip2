begin;

create table public.youtube_probes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  source_url text not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  result jsonb
);

alter table public.youtube_probes enable row level security;
revoke all on public.youtube_probes from public, anon, authenticated;
grant select, insert, update, delete on public.youtube_probes to service_role;
create index youtube_probes_created_at_idx on public.youtube_probes (created_at);

create function public.claim_youtube_probe() returns setof public.youtube_probes
language sql security definer set search_path = '' as $$
  update public.youtube_probes set claimed_at = now()
  where id = (
    select id from public.youtube_probes
    where claimed_at is null and created_at > now() - interval '45 seconds'
    order by created_at for update skip locked limit 1
  )
  returning *;
$$;

create function public.claim_clip_for_platforms(p_platforms text[]) returns setof public.clips
language sql security definer set search_path = '' as $$
  update public.clips set status = 'processing', progress = 0, stage = 'Preparando…'
  where id = (
    select id from public.clips
    where status = 'queued' and created_at < now() - interval '3 seconds'
      and (p_platforms is null or platform = any(p_platforms))
    order by created_at for update skip locked limit 1
  )
  returning *;
$$;

create function public.claim_auto_job_for_platforms(p_platforms text[]) returns setof public.auto_jobs
language sql security definer set search_path = '' as $$
  update public.auto_jobs set status = 'analyzing'
  where id = (
    select id from public.auto_jobs
    where status = 'queued' and (p_platforms is null or platform = any(p_platforms))
    order by created_at for update skip locked limit 1
  )
  returning *;
$$;

create or replace function public.claim_clip() returns setof public.clips
language sql security definer set search_path = '' as $$
  select * from public.claim_clip_for_platforms(null);
$$;

create or replace function public.claim_auto_job() returns setof public.auto_jobs
language sql security definer set search_path = '' as $$
  select * from public.claim_auto_job_for_platforms(null);
$$;

revoke all on function public.claim_youtube_probe(), public.claim_clip_for_platforms(text[]),
  public.claim_auto_job_for_platforms(text[]) from public, anon, authenticated;
grant execute on function public.claim_youtube_probe(), public.claim_clip_for_platforms(text[]),
  public.claim_auto_job_for_platforms(text[]), public.claim_clip(), public.claim_auto_job() to service_role;

commit;
