-- Nuevo plan Premium (anual).
alter table profiles drop constraint if exists profiles_plan_check;
alter table profiles add constraint profiles_plan_check check (plan in ('trial','starter','creator','pro','premium'));
