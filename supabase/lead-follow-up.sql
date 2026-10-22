-- Additive upgrade. Original Leads, business data and notification state stay untouched.
create table if not exists public.lead_followups (
  lead_id bigint primary key references public.leads(id) on delete cascade,
  status text not null default 'new' check (status in ('new','contacted','following','completed','invalid')),
  notes text not null default '' check (char_length(notes) <= 2000),
  is_test boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.lead_followups enable row level security;
revoke all on public.lead_followups from public, anon, authenticated;
grant select, insert, update on public.lead_followups to service_role;

create or replace function public.save_lead_followup(
  p_lead_id bigint, p_expected_revision integer, p_status text, p_notes text, p_is_test boolean
)
returns table(outcome text)
language plpgsql security invoker set search_path = ''
as $$
declare current_revision integer;
begin
  if p_lead_id is null or p_lead_id <= 0 or p_expected_revision is null or p_expected_revision < 0
    or p_status is null or p_status not in ('new','contacted','following','completed','invalid')
    or p_notes is null or char_length(p_notes) > 2000 or p_is_test is null then
    raise exception 'Invalid follow-up fields' using errcode = '22023';
  end if;
  -- Serialize first inserts as well as updates; never overwrite the submitted JSON.
  perform 1 from public.leads where id = p_lead_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  select revision into current_revision from public.lead_followups where lead_id = p_lead_id;
  if coalesce(current_revision, 0) <> p_expected_revision then
    return query select 'conflict'::text; return;
  end if;
  insert into public.lead_followups(lead_id,status,notes,is_test,revision,updated_at)
  values(p_lead_id,p_status,p_notes,p_is_test,p_expected_revision + 1,clock_timestamp())
  on conflict (lead_id) do update set status=excluded.status, notes=excluded.notes,
    is_test=excluded.is_test, revision=excluded.revision, updated_at=excluded.updated_at;
  return query select 'saved'::text;
end;
$$;
revoke all on function public.save_lead_followup(bigint,integer,text,text,boolean) from public, anon, authenticated;
grant execute on function public.save_lead_followup(bigint,integer,text,text,boolean) to service_role;
