begin;
insert into public.user_profiles(telegram_user_id) values(5000000000001);
set local role service_role;
do $$
declare first_id bigint; second_id bigint; is_created boolean; result_count integer; accepted boolean; readiness record;
begin
  insert into public.bot_sessions(telegram_user_id,flow,step,data) values
    (5000000000001,'buy','contact','{"source":"audit","submission_id":"audit_form_00000001"}');
  select id,created into first_id,is_created from public.create_lead_once(5000000000001,'audit_test','buy',
    '{"source":"audit","submission_id":"audit_form_00000001","completion_update_id":900001,"domain":"example.com","contact":"@audit_test"}');
  if first_id is null or not is_created then raise exception 'Initial submit failed'; end if;
  insert into public.bot_sessions(telegram_user_id,flow,step,data) values
    (5000000000001,'sell','contact','{"source":"audit","submission_id":"audit_form_00000002"}');
  select id,created into second_id,is_created from public.create_lead_once(5000000000001,'audit_test','buy',
    '{"source":"audit","submission_id":"audit_form_00000001","completion_update_id":900002,"domain":"example.com","contact":"@audit_test"}');
  if second_id<>first_id or is_created then raise exception 'Duplicate submit was not idempotent'; end if;
  select id,created into second_id,is_created from public.create_lead_once(5000000000001,'audit_test','sell',
    '{"source":"audit","submission_id":"audit_form_00000002","completion_update_id":900001,"domain":"example.org","contact":"@audit_test"}');
  if second_id<>first_id or is_created then raise exception 'Old Telegram update submitted a newer form'; end if;
  if not exists(select 1 from public.bot_sessions where telegram_user_id=5000000000001
    and data->>'submission_id'='audit_form_00000002') then raise exception 'Replay erased a newer form'; end if;
  select count(*) into result_count from public.create_lead_once(5000000000001,'audit_test','buy',
    '{"source":"audit","submission_id":"audit_stale_00000001"}');
  if result_count<>0 then raise exception 'Stale/cancelled form unexpectedly created a Lead'; end if;
  select id,created into second_id,is_created from public.create_lead_once(5000000000001,'audit_test','sell',
    '{"source":"audit","submission_id":"audit_form_00000002","domain":"example.com","price":"TEST ONLY"}');
  if second_id=first_id or not is_created then raise exception 'New legitimate form was incorrectly deduplicated'; end if;
  if (select count(*) from public.leads where telegram_user_id=5000000000001)<>2 then raise exception 'Wrong Lead count'; end if;
  if (select count(*) from public.lead_notifications where lead_id in(first_id,second_id))<>2 then raise exception 'Queue insert not atomic'; end if;

  -- Compatibility with a pre-upgrade form lacking submission_id.
  insert into public.bot_sessions(telegram_user_id,flow,step,data,updated_at)
    values(5000000000001,'contact','message','{"source":"audit"}','2026-10-22T00:00:00Z');
  select id,created into second_id,is_created from public.create_lead_once(5000000000001,'audit_test','contact',
    '{"source":"audit","submission_id":"legacy_5000000000001_1792627200000","message":"test"}');
  if second_id is null or not is_created then raise exception 'Legacy form could not complete'; end if;

  for attempt in 1..5 loop
    select allowed into accepted from public.reserve_dashboard_login(repeat('a',64));
    if not accepted then raise exception 'Login throttled too early'; end if;
  end loop;
  select allowed into accepted from public.reserve_dashboard_login(repeat('a',64));
  if accepted then raise exception 'Sixth login attempt was not blocked'; end if;
  select * into readiness from public.bot_readiness();
  if not readiness.database_ok or not readiness.commerce_ok then raise exception 'Readiness unexpectedly failed'; end if;
  if has_function_privilege('anon','public.create_lead_once(bigint,text,text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.reserve_dashboard_login(text)','EXECUTE') then
    raise exception 'Privileged function is exposed';
  end if;
end;
$$;
reset role;
revoke insert on public.lead_notifications from service_role;
set local role service_role;
do $$ declare readiness record; begin
  select * into readiness from public.bot_readiness();
  if readiness.commerce_ok then raise exception 'Missing queue write permission was shown as healthy'; end if;
end; $$;
rollback;
