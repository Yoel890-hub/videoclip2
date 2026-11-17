-- Soporte para vídeos normales (VOD) además de directos.
alter table clips add column source_kind text not null default 'live' check (source_kind in ('live','vod'));
alter table clips add column start_at_s int;  -- VOD: segundo del vídeo donde empieza el clip

drop function create_clip(uuid, text, text, text, text, int, int, int, int, boolean);
create function create_clip(p_user uuid, p_platform text, p_url text, p_format text, p_aspect text,
  p_quality int, p_start int, p_duration int, p_cost int, p_trial boolean,
  p_kind text default 'live', p_start_at int default null)
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
  insert into clips (user_id, platform, source_url, format, aspect, quality, start_offset_s, duration_s, cost, is_trial, source_kind, start_at_s)
  values (p_user, p_platform, p_url, p_format, p_aspect, p_quality, p_start, p_duration, p_cost, p_trial, p_kind, p_start_at)
  returning id into cid;
  return cid;
end $$;
revoke all on function create_clip(uuid, text, text, text, text, int, int, int, int, boolean, text, int) from public, anon, authenticated;
