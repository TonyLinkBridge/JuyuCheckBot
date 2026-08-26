-- Run once in Supabase SQL Editor for an existing JUYU Check Bot project.
-- The raw last_source value remains unchanged for analytics.

alter table public.user_profiles add column if not exists last_source_label text;

update public.user_profiles
set last_source_label = case
  when last_source = 'direct' then '直接打开 Telegram Bot'
  when last_source = 'channel' then 'JUYU Telegram 频道'
  when last_source = 'juyucom' then 'JUYU 官网'
  when last_source = 'share' then '报告分享入口'
  when last_source = 'referral' then '朋友分享链接'
  when last_source = 'juyu_check_bot' then 'JUYU 域名体检 Bot'
  when last_source = 'juyu_domain_bot' then 'JUYU 聚域助手'
  when last_source like 'morningbrief\_%' escape '\' then 'Telegram 频道活动：' || last_source
  else '活动来源：' || last_source
end
where last_source_label is null or last_source_label = '';

alter table public.user_profiles alter column last_source_label set default '直接打开 Telegram Bot';
alter table public.user_profiles alter column last_source_label set not null;
