-- CampusMatch Database Schema (v1.1)
-- Run this ONCE in Supabase Dashboard -> SQL Editor.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  age int check (age >= 18),
  bio text,
  gender text not null check (gender in ('male', 'female', 'non-binary')),
  interested_in text not null check (interested_in in ('male', 'female', 'non-binary', 'everyone')),
  college text not null,
  interests text[],
  avatar_url text,
  contact_info text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_id uuid not null references profiles(id) on delete cascade,
  swiped_id uuid not null references profiles(id) on delete cascade,
  direction text not null check (direction in ('left','right')),
  created_at timestamptz default now(),
  unique(swiper_id, swiped_id)
);
create index if not exists swipes_swiped_idx on swipes(swiped_id, direction);

-- user1_id is always the "smaller" uuid, so a pair can only exist once
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references profiles(id) on delete cascade,
  user2_id uuid not null references profiles(id) on delete cascade,
  contact_shared_1 boolean default false,
  contact_shared_2 boolean default false,
  created_at timestamptz default now(),
  unique(user1_id, user2_id),
  check (user1_id < user2_id)
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  word text not null,
  guesses jsonb default '[]',
  current_turn uuid references profiles(id),
  winner uuid references profiles(id),
  status text default 'active' check (status in ('active', 'won', 'lost', 'draw')),
  created_at timestamptz default now()
);
create index if not exists games_match_idx on games(match_id, status);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete cascade,
  reported_id uuid references profiles(id) on delete cascade,
  reason text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- The FastAPI backend (service-role key) is the only thing that touches these
-- tables, and it does its own permission checks. We enable RLS and add NO
-- policies, so the public anon key can read/write nothing directly. That keeps
-- contact_info, swipes and game words private.
-- ============================================================
alter table profiles enable row level security;
alter table swipes   enable row level security;
alter table matches  enable row level security;
alter table games    enable row level security;
alter table reports  enable row level security;

-- ============================================================
-- AVATAR STORAGE (the browser uploads photos directly, so it needs policies)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
