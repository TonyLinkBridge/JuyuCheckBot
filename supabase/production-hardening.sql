-- Additive upgrade. Existing Leads and saved legacy configuration are retained.
alter table public.leads add column if not exists submission_key text;
create unique index if not exists leads_submission_once_idx
  on public.leads (telegram_user_id, submission_key) where submission_key is not null;
create table if not exists public.lead_completion_updates (
  telegram_user_id bigint not null,
  update_id bigint not null,
  lead_id bigint not null references public.leads(id) on delete cascade,
  primary key(telegram_user_id,update_id)
);
create index if not exists lead_completion_updates_lead_idx on public.lead_completion_updates(lead_id);
alter table public.lead_completion_updates enable row level security;
revoke all on public.lead_completion_updates from public,anon,authenticated;
grant all on public.lead_completion_updates to service_role;

create or replace function public.create_lead_once(
  p_telegram_user_id bigint, p_username text, p_lead_type text, p_data jsonb
) returns table (id bigint, created boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  request_key text := p_data->>'submission_id';
  completion_update bigint := (p_data->>'completion_update_id')::bigint;
  lead_id bigint;
  active_session public.bot_sessions%rowtype;
begin
  if request_key is null or request_key !~ '^[A-Za-z0-9_-]{16,128}$'
    or p_lead_type not in ('buy', 'sell', 'contact') then
    raise exception 'Invalid submission';
  end if;
  -- Serialize a user's completions, including requests arriving on different servers.
  perform pg_catalog.pg_advisory_xact_lock(p_telegram_user_id);
  if completion_update is not null then
    select u.lead_id into lead_id from public.lead_completion_updates u
      where u.telegram_user_id=p_telegram_user_id and u.update_id=completion_update;
    if found then return query select lead_id, false; return; end if;
  end if;
  select l.id into lead_id from public.leads l
    where l.telegram_user_id=p_telegram_user_id and l.submission_key=request_key;
  if found then
    if completion_update is not null then
      insert into public.lead_completion_updates(telegram_user_id,update_id,lead_id)
        values(p_telegram_user_id,completion_update,lead_id);
    end if;
    return query select lead_id, false; return;
  end if;

  select s.* into active_session from public.bot_sessions s
    where s.telegram_user_id=p_telegram_user_id for update;
  if not found or not coalesce((
    active_session.data->>'submission_id'=request_key
    or (active_session.data->>'submission_id' is null and request_key=
      'legacy_' || p_telegram_user_id::text || '_' || floor(extract(epoch from active_session.updated_at)*1000)::bigint::text)
  ),false) then return; end if;

  insert into public.leads(telegram_user_id, username, lead_type, data, submission_key)
    values(p_telegram_user_id,coalesce(p_username,''),p_lead_type,p_data,request_key)
    returning leads.id into lead_id;
  if completion_update is not null then
    insert into public.lead_completion_updates(telegram_user_id,update_id,lead_id)
      values(p_telegram_user_id,completion_update,lead_id);
  end if;
  -- Clearing the matching form is part of the same transaction as the insert/queue trigger.
  delete from public.bot_sessions where telegram_user_id=p_telegram_user_id;
  return query select lead_id, true;
end;
$$;
revoke all on function public.create_lead_once(bigint,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_lead_once(bigint,text,text,jsonb) to service_role;

create table if not exists public.dashboard_auth_sessions (
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.dashboard_login_limits (
  bucket_key text primary key,
  attempts integer not null,
  window_started_at timestamptz not null default now()
);
alter table public.dashboard_auth_sessions enable row level security;
alter table public.dashboard_login_limits enable row level security;
revoke all on public.dashboard_auth_sessions,public.dashboard_login_limits from public,anon,authenticated;
grant all on public.dashboard_auth_sessions,public.dashboard_login_limits to service_role;

create or replace function public.reserve_dashboard_login(p_bucket_key text)
returns table(allowed boolean) language plpgsql security invoker set search_path='' as $$
declare attempt_count integer;
begin
  if p_bucket_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid login bucket'; end if;
  delete from public.dashboard_login_limits where window_started_at < now()-interval '1 day';
  delete from public.dashboard_auth_sessions where expires_at < now()-interval '1 day';
  insert into public.dashboard_login_limits(bucket_key,attempts,window_started_at)
    values(p_bucket_key,1,now())
    on conflict(bucket_key) do update set
      attempts=case when dashboard_login_limits.window_started_at < now()-interval '15 minutes'
        then 1 else dashboard_login_limits.attempts+1 end,
      window_started_at=case when dashboard_login_limits.window_started_at < now()-interval '15 minutes'
        then now() else dashboard_login_limits.window_started_at end
    returning attempts into attempt_count;
  return query select attempt_count <= 5;
end;
$$;
revoke all on function public.reserve_dashboard_login(text) from public,anon,authenticated;
grant execute on function public.reserve_dashboard_login(text) to service_role;

create or replace function public.bot_readiness()
returns table(database_ok boolean,commerce_ok boolean,stale_notifications bigint)
language sql stable security invoker set search_path='' as $$
  select
    coalesce((select true from public.leads limit 1),true),
    pg_catalog.has_table_privilege(current_user,'public.leads','INSERT')
      and pg_catalog.has_table_privilege(current_user,'public.bot_sessions','INSERT')
      and pg_catalog.has_table_privilege(current_user,'public.bot_sessions','UPDATE')
      and pg_catalog.has_table_privilege(current_user,'public.bot_sessions','DELETE')
      and pg_catalog.has_table_privilege(current_user,'public.bot_sessions','SELECT')
      and pg_catalog.has_table_privilege(current_user,'public.user_profiles','SELECT')
      and pg_catalog.has_table_privilege(current_user,'public.user_profiles','INSERT')
      and pg_catalog.has_table_privilege(current_user,'public.user_profiles','UPDATE')
      and pg_catalog.has_table_privilege(current_user,'public.domain_reports','SELECT')
      and pg_catalog.has_table_privilege(current_user,'public.domain_reports','INSERT')
      and pg_catalog.has_table_privilege(current_user,'public.domain_reports','UPDATE')
      and pg_catalog.has_table_privilege(current_user,'public.growth_events','INSERT')
      and pg_catalog.has_sequence_privilege(current_user,pg_catalog.pg_get_serial_sequence('public.leads','id'),'USAGE')
      and pg_catalog.has_sequence_privilege(current_user,pg_catalog.pg_get_serial_sequence('public.growth_events','id'),'USAGE')
      and pg_catalog.has_table_privilege(current_user,'public.lead_notifications','SELECT')
      and pg_catalog.has_table_privilege(current_user,'public.lead_notifications','INSERT')
      and pg_catalog.has_table_privilege(current_user,'public.lead_notifications','UPDATE')
      and pg_catalog.has_table_privilege(current_user,'public.lead_completion_updates','SELECT')
      and pg_catalog.has_table_privilege(current_user,'public.lead_completion_updates','INSERT')
      and pg_catalog.has_function_privilege(current_user,'public.create_lead_once(bigint,text,text,jsonb)','EXECUTE')
      and pg_catalog.has_function_privilege(current_user,'public.claim_lead_notifications(integer,bigint)','EXECUTE')
      and exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.leads'::regclass
        and tgname='queue_lead_notification' and tgenabled in ('O','A')),
    (select count(*) from public.lead_notifications where state <> 'sent' and created_at<now()-interval '15 minutes');
$$;
revoke all on function public.bot_readiness() from public,anon,authenticated;
grant execute on function public.bot_readiness() to service_role;

-- Existing advisor warnings: these trigger functions need no user-controlled search path.
alter function public.set_updated_at() set search_path='';
alter function public.clear_legacy_domain_scores() set search_path='';
