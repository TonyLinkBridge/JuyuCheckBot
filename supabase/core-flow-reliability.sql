-- Additive upgrade after schema.sql. Existing Leads are not re-notified.
create table if not exists public.lead_notifications (
  lead_id bigint primary key references public.leads(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending', 'processing', 'sent')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lead_notifications enable row level security;
revoke all on public.lead_notifications from public, anon, authenticated;
grant select, insert, update, delete on public.lead_notifications to service_role;
create index if not exists lead_notifications_due_idx
  on public.lead_notifications(next_attempt_at) where state <> 'sent';
create index if not exists leads_user_idx on public.leads(telegram_user_id);

create or replace function public.queue_lead_notification()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.lead_notifications(lead_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.queue_lead_notification() from public, anon, authenticated;
grant execute on function public.queue_lead_notification() to service_role;
drop trigger if exists queue_lead_notification on public.leads;
create trigger queue_lead_notification after insert on public.leads
for each row execute function public.queue_lead_notification();

create or replace function public.claim_lead_notifications(p_limit integer default 3, p_lead_id bigint default null)
returns table(lead_id bigint, attempts integer, telegram_user_id bigint, username text, lead_type text, data jsonb)
language sql security invoker set search_path = '' as $$
  with picked as (
    select n.lead_id from public.lead_notifications n
    where (p_lead_id is null or n.lead_id = p_lead_id)
      and ((n.state = 'pending' and n.next_attempt_at <= now())
        or (n.state = 'processing' and n.locked_until <= now()))
    order by n.next_attempt_at, n.lead_id
    limit greatest(1, least(3, p_limit))
    for update skip locked
  ), claimed as (
    update public.lead_notifications n
    set state = 'processing', attempts = n.attempts + 1,
      locked_until = now() + interval '5 minutes', updated_at = now()
    from picked p where n.lead_id = p.lead_id
    returning n.lead_id, n.attempts
  )
  select c.lead_id, c.attempts, l.telegram_user_id, l.username, l.lead_type, l.data
  from claimed c join public.leads l on l.id = c.lead_id;
$$;
revoke all on function public.claim_lead_notifications(integer, bigint) from public, anon, authenticated;
grant execute on function public.claim_lead_notifications(integer, bigint) to service_role;

create or replace function public.cleanup_bot_data(p_retention_days integer default 180)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(30, p_retention_days));
  deleted_reports integer;
  deleted_events integer;
  deleted_profiles integer;
begin
  delete from public.domain_reports where created_at < cutoff;
  get diagnostics deleted_reports = row_count;
  delete from public.growth_events where created_at < cutoff;
  get diagnostics deleted_events = row_count;
  -- A customer Lead is retained until the user explicitly requests deletion.
  -- Also protect users with recent activity even if an old client did not touch last_seen_at.
  delete from public.user_profiles u where u.last_seen_at < cutoff
    and not exists(select 1 from public.leads l where l.telegram_user_id = u.telegram_user_id)
    and not exists(select 1 from public.bot_sessions s where s.telegram_user_id = u.telegram_user_id)
    and not exists(select 1 from public.domain_reports r where r.telegram_user_id = u.telegram_user_id)
    and not exists(select 1 from public.growth_events e where e.telegram_user_id = u.telegram_user_id);
  get diagnostics deleted_profiles = row_count;
  return jsonb_build_object('reports', deleted_reports, 'events', deleted_events, 'profiles', deleted_profiles);
end;
$$;
revoke all on function public.cleanup_bot_data(integer) from public, anon, authenticated;
grant execute on function public.cleanup_bot_data(integer) to service_role;
