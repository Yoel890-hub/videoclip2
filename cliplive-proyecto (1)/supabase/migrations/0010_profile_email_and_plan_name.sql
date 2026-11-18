-- Para ver quién es quién en la tabla profiles desde el panel de Supabase:
--  · email: el correo de la cuenta (se rellena al registrarse y se actualiza si lo cambia).
--  · plan_name: el nombre del plan tal como lo ve el usuario. Se calcula solo a partir de `plan`,
--    así que cambia automáticamente cuando cambia el plan (al pagar, al cancelar o editándolo a mano).

-- 1) Nombre del plan (columna calculada: no se puede editar, se edita `plan`)
alter table public.profiles add column if not exists plan_name text generated always as (
  case plan
    when 'trial'   then 'Prueba'
    when 'starter' then 'Starter'
    when 'creator' then 'Creator'
    when 'pro'     then 'Pro'
    when 'premium' then 'Premium'
    else plan
  end
) stored;

-- 2) Correo de la cuenta
alter table public.profiles add column if not exists email text;

-- Rellenar el correo de las cuentas que ya existen
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is distinct from u.email;

-- Las cuentas nuevas se crean ya con su correo
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email);
  return new;
end $$;

-- Si un usuario cambia su correo, se actualiza también aquí
create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set email = new.email where id = new.id;
  return new;
end $$;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function public.sync_profile_email();
revoke all on function public.sync_profile_email() from public, anon, authenticated;
