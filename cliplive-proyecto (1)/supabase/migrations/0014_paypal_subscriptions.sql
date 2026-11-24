create table public.paypal_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('starter', 'creator', 'pro', 'premium')),
  paypal_plan_id text not null,
  price numeric(10, 2) not null check (price > 0),
  credits int not null check (credits > 0),
  subscription_id text unique,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  paid_at timestamptz,
  ended_at timestamptz
);

create index paypal_checkouts_user_idx on public.paypal_checkouts (user_id, created_at desc);

create table public.paypal_sales (
  id text primary key,
  checkout_id uuid not null references public.paypal_checkouts(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  received_at timestamptz not null default now()
);

alter table public.paypal_checkouts enable row level security;
alter table public.paypal_sales enable row level security;
revoke all on public.paypal_checkouts, public.paypal_sales from anon, authenticated;
grant select, update on public.paypal_checkouts to service_role;

alter table public.profiles add column paypal_checkout_id uuid
  references public.paypal_checkouts(id) on delete set null;

create function public.start_paypal_checkout(
  p_user uuid, p_plan text, p_paypal_plan text, p_price numeric, p_credits int
) returns uuid language plpgsql security definer set search_path = '' as $$
declare checkout_id uuid;
begin
  perform 1 from public.profiles where id = p_user for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  if exists (
    select 1 from public.paypal_checkouts
    where user_id = p_user and ended_at is null and (
      subscription_id is not null
      or (released_at is null and created_at > now() - interval '10 minutes')
    )
  ) then return null; end if;

  insert into public.paypal_checkouts (user_id, plan, paypal_plan_id, price, credits)
  values (p_user, p_plan, p_paypal_plan, p_price, p_credits)
  returning id into checkout_id;
  return checkout_id;
end $$;

-- La venta y los créditos se guardan en la misma transacción. PayPal puede repetir
-- una venta o entregar la cancelación antes de la confirmación de un cobro anterior.
create function public.sync_paypal_subscription(
  p_checkout uuid, p_subscription text, p_paypal_plan text, p_ended boolean,
  p_sale text default null, p_amount numeric default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  checkout public.paypal_checkouts;
  current_checkout public.paypal_checkouts;
  cycles numeric;
begin
  select * into checkout from public.paypal_checkouts where id = p_checkout;
  if not found then return false; end if;
  perform 1 from public.profiles where id = checkout.user_id for update;

  select * into checkout from public.paypal_checkouts where id = p_checkout for update;
  if not found or checkout.paypal_plan_id <> p_paypal_plan or (
    checkout.subscription_id is not null and checkout.subscription_id <> p_subscription
  ) then return false; end if;

  if p_sale is not null then
    cycles := p_amount / checkout.price;
    if cycles is null or cycles < 1 or cycles > 999 or mod(p_amount, checkout.price) <> 0 then
      raise exception 'PAYPAL_AMOUNT_MISMATCH';
    end if;
    insert into public.paypal_sales (id, checkout_id, amount) values (p_sale, p_checkout, p_amount)
    on conflict (id) do nothing;
    if not found then p_sale := null; end if;
  end if;

  update public.paypal_checkouts set subscription_id = p_subscription,
    ended_at = case when p_ended then coalesce(ended_at, now()) else ended_at end,
    paid_at = case when p_sale is not null then coalesce(paid_at, now()) else paid_at end
  where id = p_checkout;

  if p_sale is not null or p_ended then
    select * into current_checkout from public.paypal_checkouts
    where user_id = checkout.user_id and paid_at is not null and ended_at is null
    order by created_at desc, id desc limit 1;

    if p_sale is not null then
      perform public.grant_credits(checkout.user_id, current_checkout.plan,
        checkout.credits * cycles::int, 'paypal:' || checkout.plan);
    end if;

    if current_checkout.id is not null then
      update public.profiles set plan = current_checkout.plan, paypal_checkout_id = current_checkout.id
      where id = checkout.user_id;
    else
      update public.profiles set plan = 'trial', paypal_checkout_id = null
      where id = checkout.user_id and paypal_checkout_id is not null;
    end if;
  end if;
  return true;
end $$;

revoke all on function public.start_paypal_checkout(uuid, text, text, numeric, int) from public, anon, authenticated;
revoke all on function public.sync_paypal_subscription(uuid, text, text, boolean, text, numeric) from public, anon, authenticated;
grant execute on function public.start_paypal_checkout(uuid, text, text, numeric, int) to service_role;
grant execute on function public.sync_paypal_subscription(uuid, text, text, boolean, text, numeric) to service_role;

-- Las renovaciones de Stripe anteriores conservan sus créditos mientras existan.
create function public.record_stripe_event(p_event text, p_user uuid, p_plan text, p_credits int)
returns void language plpgsql security definer set search_path = '' as $$
declare checkout_id uuid;
begin
  insert into public.stripe_events (id) values (p_event) on conflict do nothing;
  if not found then return; end if;

  select paypal_checkout_id into checkout_id from public.profiles where id = p_user for update;
  if not found then return; end if;
  if p_plan is not null then
    perform public.grant_credits(p_user, case when checkout_id is null then p_plan end,
      p_credits, 'plan:' || p_plan);
  elsif checkout_id is null then
    update public.profiles set plan = 'trial' where id = p_user;
  end if;
end $$;

revoke all on function public.record_stripe_event(text, uuid, text, int) from public, anon, authenticated;
grant execute on function public.record_stripe_event(text, uuid, text, int) to service_role;
