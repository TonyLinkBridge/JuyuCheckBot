-- Acceptance on an existing Lead, always rolled back. No new Lead or notification.
begin;
set local role service_role;
do $$
declare target_id bigint; original_data jsonb; original_notifications bigint;
  initial_revision integer; result text;
begin
  select id,data into target_id,original_data from public.leads order by id limit 1;
  if target_id is null then raise exception 'Needs one existing Lead to test'; end if;
  select count(*) into original_notifications from public.lead_notifications;
  select coalesce((select revision from public.lead_followups where lead_id=target_id),0) into initial_revision;
  select outcome into result from public.save_lead_followup(target_id,initial_revision,'contacted','回滚验收测试',true);
  if result <> 'saved' then raise exception 'First save failed'; end if;
  if not exists (select 1 from public.lead_followups where lead_id=target_id and status='contacted' and is_test and notes='回滚验收测试' and revision=initial_revision+1) then
    raise exception 'Persisted fields incorrect';
  end if;
  select outcome into result from public.save_lead_followup(target_id,initial_revision,'invalid','Stale overwrite',false);
  if result <> 'conflict' then raise exception 'Stale update overwrote newer changes'; end if;
  select outcome into result from public.save_lead_followup(target_id,initial_revision+1,'following','已联系，待回复',false);
  if result <> 'saved' then raise exception 'Second save failed'; end if;
  if not exists (select 1 from public.lead_followups where lead_id=target_id and status='following' and not is_test and revision=initial_revision+2) then
    raise exception 'Restore classification failed';
  end if;
  if (select data from public.leads where id=target_id) is distinct from original_data then raise exception 'Business data modified'; end if;
  if (select count(*) from public.lead_notifications) <> original_notifications then raise exception 'Unexpected notification'; end if;
  select outcome into result from public.save_lead_followup((select max(id)+1 from public.leads),0,'new','',false);
  if result <> 'not_found' then raise exception 'Missing lead accepted'; end if;
  begin
    perform public.save_lead_followup(-1,0,'new','',false);
    raise exception 'Invalid id accepted';
  exception when invalid_parameter_value then null; end;
end;
$$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.lead_followups','select')
    or has_table_privilege('authenticated','public.lead_followups','update')
    or has_function_privilege('anon','public.save_lead_followup(bigint,integer,text,text,boolean)','execute')
    or has_function_privilege('authenticated','public.save_lead_followup(bigint,integer,text,text,boolean)','execute') then
    raise exception 'Private follow-ups exposed';
  end if;
end $$;
rollback;
