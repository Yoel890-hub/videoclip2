-- Arreglo: "Database error saving new user" al registrarse.
-- Las funciones "security definer" se ejecutaban sin search_path y, al lanzarse desde el esquema auth
-- (trigger de alta de usuario), no encontraban la tabla profiles. Se fija search_path = public en todas.
alter function public.handle_new_user() set search_path = public;
alter function public.create_clip(uuid, text, text, text, text, int, int, int, int, boolean, text, int) set search_path = public;
alter function public.refund_clip(uuid, text) set search_path = public;
alter function public.grant_credits(uuid, text, int, text) set search_path = public;
alter function public.apply_referral(uuid, text) set search_path = public;
