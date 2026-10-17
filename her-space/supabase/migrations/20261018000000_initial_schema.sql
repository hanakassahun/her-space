-- =====================================================================
-- Her Space: initial schema
-- Rebuilds the database on an EMPTY Supabase project.
--
-- DO NOT run this on the live project: the tables already exist there.
-- This file is a backup/blueprint, reconstructed from the SQL used while
-- building the app. Verify it against the live database before trusting it.
--
-- Not included (data, not schema): invite codes, Learn articles, resources,
-- verified professionals, and the admin row. See the SEED NOTES at the end.
-- =====================================================================


-- =====================================================================
-- 1. PROFILES (pseudonymous display name, one per auth user)
-- =====================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  bio text not null default '' check (char_length(bio) <= 160),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Signed-in users can view profiles"
  on public.profiles for select to authenticated using (true);
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can edit their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);


-- =====================================================================
-- 2. ADMINS and is_admin()
-- No insert/update/delete policies: clients can never make themselves admin.
-- Add admins from the SQL Editor only.
-- =====================================================================
create table public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);

alter table public.admins enable row level security;

create policy "Users can see their own admin row"
  on public.admins for select to authenticated using (auth.uid() = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;


-- =====================================================================
-- 3. POSTS (type, provenance label, sources, sensitive flag)
-- =====================================================================
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  type text not null check (type in ('experience', 'question', 'knowledge')),
  title text not null check (char_length(title) between 3 and 150),
  body text not null check (char_length(body) between 1 and 5000),
  topics text[] not null default '{}',
  provenance text not null default 'personal'
    check (provenance in ('personal', 'community', 'evidence')),
  sources text[] not null default '{}',
  sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  constraint posts_evidence_needs_sources
    check (provenance <> 'evidence' or cardinality(sources) >= 1)
);

alter table public.posts enable row level security;

create policy "Signed-in users can read posts"
  on public.posts for select to authenticated using (true);
create policy "Users can create their own posts"
  on public.posts for insert to authenticated with check (auth.uid() = author_id);
create policy "Users can edit their own posts"
  on public.posts for update to authenticated using (auth.uid() = author_id);
create policy "Users can delete their own posts"
  on public.posts for delete to authenticated using (auth.uid() = author_id);
create policy "Admins can delete any post"
  on public.posts for delete to authenticated using (public.is_admin());


-- =====================================================================
-- 4. COMMENTS
-- =====================================================================
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "Signed-in users can read comments"
  on public.comments for select to authenticated using (true);
create policy "Users can create their own comments"
  on public.comments for insert to authenticated with check (auth.uid() = author_id);
create policy "Users can delete their own comments"
  on public.comments for delete to authenticated using (auth.uid() = author_id);
create policy "Admins can delete any comment"
  on public.comments for delete to authenticated using (public.is_admin());


-- =====================================================================
-- 5. BOOKMARKS, LIKES, FOLLOWS
-- Bookmarks are private: only the owner can see them.
-- Likes and follows are readable by signed-in users (needed for counts).
-- =====================================================================
create table public.bookmarks (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.bookmarks enable row level security;

create policy "Users can see their own bookmarks"
  on public.bookmarks for select to authenticated using (auth.uid() = user_id);
create policy "Users can create their own bookmarks"
  on public.bookmarks for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can delete their own bookmarks"
  on public.bookmarks for delete to authenticated using (auth.uid() = user_id);

create table public.likes (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.likes enable row level security;

create policy "Signed-in users can read likes"
  on public.likes for select to authenticated using (true);
create policy "Users can create their own likes"
  on public.likes for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can delete their own likes"
  on public.likes for delete to authenticated using (auth.uid() = user_id);

create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

alter table public.follows enable row level security;

create policy "Signed-in users can read follows"
  on public.follows for select to authenticated using (true);
create policy "Users can follow as themselves"
  on public.follows for insert to authenticated with check (auth.uid() = follower_id);
create policy "Users can unfollow as themselves"
  on public.follows for delete to authenticated using (auth.uid() = follower_id);


-- =====================================================================
-- 6. REPORTS (moderation). Only admins can read or update.
-- =====================================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  check (post_id is not null or comment_id is not null)
);

alter table public.reports enable row level security;

create policy "Users can file reports as themselves"
  on public.reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy "Admins can read reports"
  on public.reports for select to authenticated using (public.is_admin());
create policy "Admins can update reports"
  on public.reports for update to authenticated using (public.is_admin());


-- =====================================================================
-- 7. VERIFIED PROFESSIONALS (badge shown next to a name)
-- Deliberately a separate table: users can edit their own profile row,
-- so a "verified" flag on profiles could be faked.
-- =====================================================================
create table public.verified_professionals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  title text not null
);

alter table public.verified_professionals enable row level security;

create policy "Signed-in users can see verified professionals"
  on public.verified_professionals for select to authenticated using (true);
create policy "Admins can manage verified professionals"
  on public.verified_professionals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- =====================================================================
-- 8. JOURNAL ENTRIES (private body journal)
-- Owner only. No admin override, no policy for anyone else.
-- =====================================================================
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  entry_date date not null default current_date,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  period_status text check (period_status in ('none', 'spotting', 'light', 'medium', 'heavy')),
  symptoms text[] not null default '{}',
  notes text not null default '' check (char_length(notes) <= 3000),
  created_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

alter table public.journal_entries enable row level security;

create policy "Owner can read own journal entries"
  on public.journal_entries for select to authenticated using (auth.uid() = user_id);
create policy "Owner can create own journal entries"
  on public.journal_entries for insert to authenticated with check (auth.uid() = user_id);
create policy "Owner can update own journal entries"
  on public.journal_entries for update to authenticated using (auth.uid() = user_id);
create policy "Owner can delete own journal entries"
  on public.journal_entries for delete to authenticated using (auth.uid() = user_id);


-- =====================================================================
-- 9. LEARN ARTICLES (with Amharic translation columns)
-- Members see only published articles. Admins manage everything.
-- =====================================================================
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  summary text not null default '',
  category text not null check (category in ('health', 'body_beauty', 'mind_life', 'life_stages')),
  topics text[] not null default '{}',
  normal text not null default '',
  needs_attention text not null default '',
  see_doctor text not null default '',
  doctor_questions text[] not null default '{}',
  sources text[] not null default '{}',
  reviewed_by text,
  published boolean not null default false,
  -- Amharic versions (optional; the app falls back to English when empty)
  title_am text,
  summary_am text,
  normal_am text,
  needs_attention_am text,
  see_doctor_am text,
  doctor_questions_am text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.articles enable row level security;

create policy "Members can read published articles"
  on public.articles for select to authenticated using (published = true);
create policy "Admins can manage articles"
  on public.articles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- =====================================================================
-- 10. RESOURCES (clinics etc.) and SUGGESTIONS
-- =====================================================================
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('clinic', 'hospital', 'gynecologist', 'pharmacy', 'counseling', 'hotline', 'other')),
  city text not null default 'Addis Ababa',
  area text,
  services text[] not null default '{}',
  approx_cost text,
  phone text,
  address text,
  notes text,
  last_verified date,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.resources enable row level security;

create policy "Members can read published resources"
  on public.resources for select to authenticated using (published = true);
create policy "Admins can manage resources"
  on public.resources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table public.resource_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggested_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  details text not null check (char_length(details) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'added', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.resource_suggestions enable row level security;

create policy "Members can send suggestions as themselves"
  on public.resource_suggestions for insert to authenticated
  with check (auth.uid() = suggested_by);
create policy "Admins can read suggestions"
  on public.resource_suggestions for select to authenticated using (public.is_admin());
create policy "Admins can update suggestions"
  on public.resource_suggestions for update to authenticated using (public.is_admin());


-- =====================================================================
-- 11. INVITE CODES
-- Clients cannot read the table. Signup uses the two functions below.
-- Admins can manage codes through the admin page.
-- =====================================================================
create table public.invite_codes (
  code text primary key,
  max_uses int not null,
  uses int not null default 0,
  active boolean not null default true
);

alter table public.invite_codes enable row level security;

create policy "Admins can view invite codes"
  on public.invite_codes for select to authenticated using (public.is_admin());
create policy "Admins can create invite codes"
  on public.invite_codes for insert to authenticated with check (public.is_admin());
create policy "Admins can update invite codes"
  on public.invite_codes for update to authenticated using (public.is_admin());
create policy "Admins can delete invite codes"
  on public.invite_codes for delete to authenticated using (public.is_admin());

-- Callable before the account exists (signup checks the code first).
create or replace function public.is_invite_code_valid(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invite_codes
    where code = p_code and active and uses < max_uses
  );
$$;

revoke execute on function public.is_invite_code_valid(text) from public;
grant execute on function public.is_invite_code_valid(text) to anon, authenticated;

-- Atomic: increments uses only if the code is still valid.
create or replace function public.redeem_invite_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.invite_codes
     set uses = uses + 1
   where code = p_code and active and uses < max_uses;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke execute on function public.redeem_invite_code(text) from public, anon;
grant execute on function public.redeem_invite_code(text) to authenticated;


-- =====================================================================
-- 12. SELF-SERVICE ACCOUNT DELETION
-- Existing "on delete cascade" foreign keys remove the user's profile,
-- posts, comments, bookmarks, likes, follows, journal entries, and reports.
-- =====================================================================
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;


-- =====================================================================
-- 13. RATE LIMITS (admins exempt)
-- =====================================================================
create or replace function public.limit_post_rate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if (select count(*) from public.posts
      where author_id = new.author_id
        and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You are posting too fast. Please wait a while and try again.';
  end if;
  return new;
end;
$$;

create trigger posts_rate_limit
  before insert on public.posts
  for each row execute function public.limit_post_rate();

create or replace function public.limit_comment_rate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if (select count(*) from public.comments
      where author_id = new.author_id
        and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'You are commenting too fast. Please wait a while and try again.';
  end if;
  return new;
end;
$$;

create trigger comments_rate_limit
  before insert on public.comments
  for each row execute function public.limit_comment_rate();


-- =====================================================================
-- 14. INDEXES
-- =====================================================================
create index posts_author_id_idx on public.posts (author_id);
create index posts_topics_gin_idx on public.posts using gin (topics);
create index comments_post_id_idx on public.comments (post_id);
create index bookmarks_user_id_idx on public.bookmarks (user_id);
create index likes_post_id_idx on public.likes (post_id);
create index follows_followee_id_idx on public.follows (followee_id);
create index journal_entries_user_date_idx on public.journal_entries (user_id, entry_date desc);
create index articles_category_idx on public.articles (category);
create index articles_topics_gin_idx on public.articles using gin (topics);


-- =====================================================================
-- SEED NOTES (run manually after the schema, if rebuilding)
-- =====================================================================
-- Starter invite code:
--   insert into public.invite_codes (code, max_uses) values ('HERSPACE-BETA', 20);
--
-- Make yourself an admin (after you have signed up):
--   insert into public.admins (user_id)
--   select id from public.profiles where display_name = 'your-display-name';
--
-- Learn articles: re-run the saved INSERT for the five drafts (published = false).
-- Resources and verified professionals: re-enter by hand; keep your own export.
--
-- Auth settings that are NOT in SQL and must be set in the dashboard:
--   - Authentication > Providers > Email: confirm email setting, minimum password length
--   - Authentication > URL Configuration: Site URL and /reset-password redirect
--   - Anonymous sign-ins: OFF