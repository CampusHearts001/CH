-- Run this ONLY if you already ran the ORIGINAL supabase_schema.sql.
-- It removes the old public policies (they exposed contact_info and game words
-- to anyone holding the public anon key) and adds the new safeguards.

drop policy if exists "Public profiles are viewable"   on profiles;
drop policy if exists "Users can insert own profile"   on profiles;
drop policy if exists "Users can update own profile"   on profiles;
drop policy if exists "Users manage own swipes"        on swipes;
drop policy if exists "Users see own matches"          on matches;
drop policy if exists "System creates matches"         on matches;
drop policy if exists "Users update own match"         on matches;
drop policy if exists "Match users see games"          on games;
drop policy if exists "Match users update games"       on games;
drop policy if exists "Match users insert games"       on games;
drop policy if exists "Users can report"               on reports;

alter table swipes alter column swiper_id set not null;
alter table swipes alter column swiped_id set not null;
alter table swipes alter column direction set not null;
alter table matches alter column user1_id set not null;
alter table matches alter column user2_id set not null;
alter table matches drop constraint if exists matches_user_order;
alter table matches add constraint matches_user_order check (user1_id < user2_id);

create index if not exists swipes_swiped_idx on swipes(swiped_id, direction);
create index if not exists games_match_idx on games(match_id, status);
-- RLS stays enabled on every table, now with no public policies.
-- The avatars bucket + its storage policies are unchanged.
