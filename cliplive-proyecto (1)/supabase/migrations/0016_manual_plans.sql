-- Planes pagados en efectivo: el dueño (Administración) asigna un plan con fecha de vencimiento.
-- Al vencer, la cuenta vuelve a Prueba sola (la web lo comprueba cada vez que el cliente entra).
alter table public.profiles add column if not exists manual_plan boolean not null default false;
alter table public.profiles add column if not exists plan_expires_at timestamptz;

-- Da (o alarga) un plan en efectivo: suma los créditos de todos los periodos pagados y calcula el vencimiento.
-- Si ya tenía ese mismo plan en efectivo sin vencer, el tiempo se suma a partir de su vencimiento actual.
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
  update public.profiles
    set plan = p_plan, credits = credits + p_credits * p_periods, manual_plan = true, plan_expires_at = ends_at
    where id = p_user;
  insert into public.credit_ledger (user_id, delta, reason) values (p_user, p_credits * p_periods, left('efectivo:' || p_plan || ' ' || coalesce(p_note, ''), 200));
  return ends_at;
end $$;

-- Vuelve a Prueba los planes en efectivo vencidos (de un cliente o de todos). No toca suscripciones de PayPal.
create or replace function public.expire_manual_plans(p_user uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.profiles set plan = 'trial', manual_plan = false, plan_expires_at = null
  where manual_plan and plan_expires_at <= now() and paypal_checkout_id is null and (p_user is null or id = p_user);
  get diagnostics n = row_count;
  return n;
end $$;

-- Quita el plan en efectivo ahora mismo (por ejemplo, si te equivocaste).
create or replace function public.remove_manual_plan(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set plan = 'trial', manual_plan = false, plan_expires_at = null
  where id = p_user and manual_plan and paypal_checkout_id is null;
end $$;

revoke all on function public.grant_manual_plan(uuid, text, int, int, int, text) from public, anon, authenticated;
revoke all on function public.expire_manual_plans(uuid) from public, anon, authenticated;
revoke all on function public.remove_manual_plan(uuid) from public, anon, authenticated;
grant execute on function public.grant_manual_plan(uuid, text, int, int, int, text) to service_role;
grant execute on function public.expire_manual_plans(uuid) to service_role;
grant execute on function public.remove_manual_plan(uuid) to service_role;
