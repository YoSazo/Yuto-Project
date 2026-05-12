-- SMS OTP challenges for signup (written only by serverless API using service role).
create table if not exists public.phone_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_digest text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists phone_otp_challenges_phone_created_idx
  on public.phone_otp_challenges (phone, created_at desc);

alter table public.phone_otp_challenges enable row level security;

alter table public.profiles
  add column if not exists phone_verified_at timestamptz,
  add column if not exists sms_money_alerts boolean not null default false;

comment on column public.profiles.phone_verified_at is 'When this phone_number was confirmed via SMS OTP.';
comment on column public.profiles.sms_money_alerts is 'Opt-in: duplicate money notifications via SMS (Africa''s Talking).';
