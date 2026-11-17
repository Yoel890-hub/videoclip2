-- ClipLive: esquema base. Ejecutar en el SQL editor de Supabase o con `supabase db push`.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  plan text not null default 'trial' check (plan in ('trial','starter','creator','pro')),
  credits int not null default 0 check (credits >= 0),
  trials_used int not null default 0,
  referral_code text unique not null default substr(md5(random()::text), 1, 8),
  referred_by uuid references profiles(id),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);
create table clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  platform text not null, source_url text not null, title text,
  format text not null check (format in ('video','audio','image')),
  aspect text, quality int, start_offset_s int not null default 0, duration_s int not null default 30,
  cost int not null, is_trial boolean not null default false,
  status text not null default 'queued' check (status in ('queued','processing','ready','error')),
  error text, storage_key text, size_bytes bigint,
  expires_at timestamptz, created_at timestamptz not null default now()
);
create index on clips (user_id, created_at desc);
create table credit_ledger (
  id bigserial primary key, user_id uuid not null references profiles(id) on delete cascade,
  delta int not null, reason text not null, clip_id uuid, created_at timestamptz not null default now()
);
create table stripe_events (id text primary key, created_at timestamptz not null default now());

alter table profiles enable row level security;
alter table clips enable row level security;
alter table credit_ledger enable row level security;
alter table stripe_events enable row level security;
create policy "own profile" on profiles for select using (auth.uid() = id);
create policy "own clips" on clips for select using (auth.uid() = user_id);
create policy "own ledger" on credit_ledger for select using (auth.uid() = user_id);
-- Las escrituras las hace solo el servidor con la service role key.

create function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Crea un clip descontando créditos (o una prueba gratis) de forma atómica.
create function create_clip(p_user uuid, p_platform text, p_url text, p_format text, p_aspect text,
  p_quality int, p_start int, p_duration int, p_cost int, p_trial boolean)
returns uuid language plpgsql security definer as $$
declare pr profiles; cid uuid;
begin
  select * into pr from profiles where id = p_user for update;
  if p_trial then
    if pr.trials_used >= 3 then raise exception 'NO_TRIALS'; end if;
    update profiles set trials_used = trials_used + 1 where id = p_user;
  else
    if pr.credits < p_cost then raise exception 'NO_CREDITS'; end if;
    update profiles set credits = credits - p_cost where id = p_user;
    insert into credit_ledger (user_id, delta, reason) values (p_user, -p_cost, 'clip');
  end if;
  insert into clips (user_id, platform, source_url, format, aspect, quality, start_offset_s, duration_s, cost, is_trial)
  values (p_user, p_platform, p_url, p_format, p_aspect, p_quality, p_start, p_duration, p_cost, p_trial)
  returning id into cid;
  return cid;
end $$;

-- Si el clip falla, devuelve créditos o la prueba (solo una vez).
create function refund_clip(p_clip uuid, p_error text) returns void language plpgsql security definer as $$
declare c clips;
begin
  select * into c from clips where id = p_clip for update;
  if c.status = 'error' then return; end if;
  update clips set status = 'error', error = p_error where id = p_clip;
  if c.is_trial then update profiles set trials_used = greatest(trials_used - 1, 0) where id = c.user_id;
  else
    update profiles set credits = credits + c.cost where id = c.user_id;
    insert into credit_ledger (user_id, delta, reason, clip_id) values (c.user_id, c.cost, 'refund', p_clip);
  end if;
end $$;

create function grant_credits(p_user uuid, p_plan text, p_credits int, p_reason text) returns void
language plpgsql security definer as $$
begin
  update profiles set plan = coalesce(p_plan, plan), credits = credits + p_credits where id = p_user;
  insert into credit_ledger (user_id, delta, reason) values (p_user, p_credits, p_reason);
end $$;

-- Bonus de invitación: 60 créditos a quien invita, una sola vez por invitado.
create function apply_referral(p_new uuid, p_code text) returns boolean language plpgsql security definer as $$
declare inviter uuid;
begin
  select id into inviter from profiles where referral_code = p_code and id <> p_new;
  if inviter is null then return false; end if;
  update profiles set referred_by = inviter where id = p_new and referred_by is null;
  if not found then return false; end if;
  perform grant_credits(inviter, null, 60, 'referral');
  return true;
end $$;
revoke all on function create_clip, refund_clip, grant_credits, apply_referral from public, anon, authenticated;
