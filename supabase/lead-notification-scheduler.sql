-- Install core-flow-reliability.sql first.
-- Provision the derived worker token in Supabase Vault as
-- `juyu_lead_notification_token`. Never store a Bot token here or in Git.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists(select 1 from vault.secrets where name = 'juyu_lead_notification_token') then
    raise exception 'Configure juyu_lead_notification_token in Vault first';
  end if;
end;
$$;

select cron.schedule('juyu-lead-notifications', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://juyu-check-bot.vercel.app/internal/lead-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'juyu_lead_notification_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (
    select 1 from public.lead_notifications
    where (state = 'pending' and next_attempt_at <= now())
      or (state = 'processing' and locked_until <= now())
  );
$job$);
