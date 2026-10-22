-- Run after core-flow-reliability.sql. Every test row is rolled back.
begin;
set local role service_role;
do $test$
declare
  test_lead bigint;
  claimed integer;
begin
  insert into public.user_profiles(telegram_user_id, last_seen_at)
  values (-900000000001, now() - interval '11000 days'),
    (-900000000002, now() - interval '11000 days'),
    (-900000000003, now() - interval '11000 days');
  insert into public.leads(lead_type, telegram_user_id, username, data)
  values ('buy', -900000000001, 'regression_test', '{"domain":"example.com","source":"test"}')
  returning id into test_lead;
  assert exists(select 1 from public.lead_notifications where lead_id = test_lead and state = 'pending'), 'Lead must atomically queue notification';
  select count(*) into claimed from public.claim_lead_notifications(3, test_lead);
  assert claimed = 1, 'First worker must claim notification';
  select count(*) into claimed from public.claim_lead_notifications(3, test_lead);
  assert claimed = 0, 'Second worker must not duplicate active claim';
  update public.lead_notifications set locked_until = now() - interval '1 second' where lead_id = test_lead;
  select count(*) into claimed from public.claim_lead_notifications(3, test_lead);
  assert claimed = 1, 'Expired worker lease must be recoverable';
  assert exists(select 1 from public.lead_notifications where lead_id = test_lead and attempts = 2), 'Retry attempt must advance';
  insert into public.growth_events(event_name, telegram_user_id) values ('test', -900000000002);
  perform public.cleanup_bot_data(10000);
  assert exists(select 1 from public.leads where id = test_lead), 'Cleanup must retain Lead';
  assert exists(select 1 from public.user_profiles where telegram_user_id = -900000000001), 'Cleanup must retain Lead owner';
  assert exists(select 1 from public.user_profiles where telegram_user_id = -900000000002), 'Cleanup must retain recently active user';
  assert not exists(select 1 from public.user_profiles where telegram_user_id = -900000000003), 'Cleanup may remove inactive profile without records';
  assert not has_table_privilege('anon', 'public.lead_notifications', 'SELECT'), 'Queue must not be public';
  assert not has_function_privilege('anon', 'public.claim_lead_notifications(integer,bigint)', 'EXECUTE'), 'Claim must not be public';
  assert not has_function_privilege('authenticated', 'public.cleanup_bot_data(integer)', 'EXECUTE'), 'Cleanup must be server-only';
end;
$test$;
rollback;
select 'PASS: queue, retry lease, retention, permissions; all test rows rolled back' as verification;
