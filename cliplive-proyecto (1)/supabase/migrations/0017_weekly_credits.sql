-- Créditos que se recargan cada semana: el mismo día de la semana en que se pagó el plan, el saldo vuelve a
-- llenarse hasta el tope semanal del plan (lo que sobra no se acumula). Si se acaban antes, hay que esperar
-- al siguiente día de recarga. La web lo comprueba cada vez que el cliente entra.
alter table public.profiles add column if not exists credits_refill_at timestamptz;

create or replace function public.refill_weekly_credits(p_user uuid, p_cap int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  pr public.profiles;
  next_at timestamptz;
  added int := 0;
begin
  select * into pr from public.profiles where id = p_user for update;
  if not found or pr.plan = 'trial' or p_cap <= 0 then return 0; end if;
  next_at := coalesce(pr.credits_refill_at, now());          -- primera vez: recarga ahora y la próxima en 7 días
  if next_at > now() then return 0; end if;
  while next_at <= now() loop next_at := next_at + interval '7 days'; end loop;
  if pr.credits < p_cap then
    added := p_cap - pr.credits;
    insert into public.credit_ledger (user_id, delta, reason) values (p_user, added, 'recarga semanal:' || pr.plan);
  end if;
  update public.profiles set credits = greatest(credits, p_cap), credits_refill_at = next_at where id = p_user;
  return added;
end $$;

-- Planes en efectivo: ahora dan el saldo semanal (no la suma de todos los periodos) y empiezan las recargas
-- semanales desde el día del pago.
create or replace function public.grant_manual_plan(
  p_user uuid, p_plan text, p_periods int, p_months int, p_credits int, p_note text
) returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  pr public.profiles;
  start_at timestamptz;
  ends_at timestamptz;
begin
  if p_plan not in ('starter', 'creator', 'pro', 'premium') then raise exception 'PLAN_NOT_VALID'; end if;
  if p_periods < 1 or p_periods > 24 or p_months < 1 or p_credits < 0 then raise exception 'PERIODS_NOT_VALID'; end if;
  select * into pr from public.profiles where id = p_user for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if pr.paypal_checkout_id is not null then raise exception 'PAYPAL_ACTIVE'; end if;

  start_at := case when pr.manual_plan and pr.plan = p_plan and pr.plan_expires_at > now() then pr.plan_expires_at else now() end;
  ends_at := start_at + make_interval(months => p_months * p_periods);
  if pr.credits < p_credits then
    insert into public.credit_ledger (user_id, delta, reason)
    values (p_user, p_credits - pr.credits, left('efectivo:' || p_plan || ' ' || coalesce(p_note, ''), 200));
  end if;
  update public.profiles
    set plan = p_plan, credits = greatest(credits, p_credits), manual_plan = true, plan_expires_at = ends_at,
        credits_refill_at = case when pr.manual_plan and pr.plan = p_plan and pr.credits_refill_at > now()
                                 then pr.credits_refill_at else now() + interval '7 days' end
    where id = p_user;
  return ends_at;
end $$;

-- Al volver a Prueba se olvida el día de recarga (si vuelve a pagar, empieza de nuevo ese día).
create or replace function public.expire_manual_plans(p_user uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.profiles set plan = 'trial', manual_plan = false, plan_expires_at = null, credits_refill_at = null
  where manual_plan and plan_expires_at <= now() and paypal_checkout_id is null and (p_user is null or id = p_user);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.remove_manual_plan(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set plan = 'trial', manual_plan = false, plan_expires_at = null, credits_refill_at = null
  where id = p_user and manual_plan and paypal_checkout_id is null;
end $$;

revoke all on function public.refill_weekly_credits(uuid, int) from public, anon, authenticated;
grant execute on function public.refill_weekly_credits(uuid, int) to service_role;
