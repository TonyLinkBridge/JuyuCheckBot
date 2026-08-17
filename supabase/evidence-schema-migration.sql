-- Run once in the Supabase SQL Editor for an existing JUYU Check Bot project.
-- It removes misleading score values while keeping the old columns temporarily
-- so both old and new deployed functions remain wire-compatible during rollout.

alter table public.domain_reports alter column score drop not null;
alter table public.domain_reports alter column grade drop not null;
alter table public.domain_reports alter column score_version drop not null;
alter table public.domain_reports alter column confidence drop not null;
alter table public.domain_reports alter column data_coverage drop not null;
alter table public.domain_reports alter column dimension_scores drop not null;
alter table public.domain_reports alter column dimension_scores drop default;

update public.domain_reports
set score = null,
    grade = null,
    score_version = null,
    confidence = null,
    data_coverage = null,
    dimension_scores = null
where coalesce(report->>'reportVersion', '') like 'JUYU-EVIDENCE-%';

create or replace function public.clear_legacy_domain_scores()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.report->>'reportVersion', '') like 'JUYU-EVIDENCE-%' then
    new.score = null;
    new.grade = null;
    new.score_version = null;
    new.confidence = null;
    new.data_coverage = null;
    new.dimension_scores = null;
  end if;
  return new;
end;
$$;

drop trigger if exists domain_reports_clear_legacy_scores on public.domain_reports;
create trigger domain_reports_clear_legacy_scores
before insert or update on public.domain_reports
for each row execute function public.clear_legacy_domain_scores();

comment on column public.domain_reports.score is 'Legacy only; null for JUYU-EVIDENCE reports.';
comment on column public.domain_reports.grade is 'Legacy only; null for JUYU-EVIDENCE reports.';
comment on column public.domain_reports.score_version is 'Legacy only; reportVersion now lives inside report JSON.';
comment on column public.domain_reports.confidence is 'Legacy only; null for JUYU-EVIDENCE reports.';
comment on column public.domain_reports.dimension_scores is 'Legacy only; null for JUYU-EVIDENCE reports.';
