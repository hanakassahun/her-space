-- =====================================================================
-- Her Space: mute / block + in-app feedback
-- ADDITIVE and safe to run on the live project at any time.
-- (Run it once. Re-running will fail with "already exists" errors.)
-- =====================================================================


-- =====================================================================
-- 1. USER_BLOCKS
-- kind = 'mute'  -> I stop seeing her posts and comments. She is not told.
-- kind = 'block' -> Same, AND she can no longer see my posts/comments or
--                   comment on my posts. She is not told.
-- A member can only see and change her own rows.
-- =====================================================================
create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'mute' check (kind in ('mute', 'block')),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

create policy "Members can see their own mutes and blocks"
  on public.user_blocks for select to authenticated using (auth.uid() = blocker_id);
create policy "Members can mute or block as themselves"
  on public.user_blocks for insert to authenticated with check (auth.uid() = blocker_id);
create policy "Members can change their own mutes and blocks"
  on public.user_blocks for update to authenticated
  using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
create policy "Members can remove their own mutes and blocks"
  on public.user_blocks for delete to authenticated using (auth.uid() = blocker_id);

create index user_blocks_blocked_id_idx on public.user_blocks (blocked_id);


-- =====================================================================
-- 2. HELPER FUNCTIONS
-- SECURITY DEFINER so they can see blocks made BY other members
-- (a normal member can only read her own rows).
-- =====================================================================

-- True if the author's content should be hidden from the current member:
--   I muted/blocked her, OR she blocked me.
create or replace function public.is_hidden_from_me(p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_author)
       or (b.blocker_id = p_author and b.blocked_id = auth.uid() and b.kind = 'block')
  );
$$;

revoke execute on function public.is_hidden_from_me(uuid) from public, anon;
grant execute on function public.is_hidden_from_me(uuid) to authenticated;

-- True if the post's author has blocked the current member.
create or replace function public.is_blocked_by_post_author(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts p
    join public.user_blocks b on b.blocker_id = p.author_id
    where p.id = p_post_id
      and b.blocked_id = auth.uid()
      and b.kind = 'block'
  );
$$;

revoke execute on function public.is_blocked_by_post_author(uuid) from public, anon;
grant execute on function public.is_blocked_by_post_author(uuid) to authenticated;


-- =====================================================================
-- 3. RESTRICTIVE POLICIES
-- Restrictive policies are ANDed with the existing permissive ones, so
-- the current "read posts / read comments" policies do not need to change.
-- A member's own content and admins are never hidden (admins must be able
-- to moderate everything).
-- =====================================================================
create policy "Hide muted and blocked authors"
  on public.posts as restrictive for select to authenticated
  using (author_id = auth.uid() or public.is_admin() or not public.is_hidden_from_me(author_id));

create policy "Hide muted and blocked authors"
  on public.comments as restrictive for select to authenticated
  using (author_id = auth.uid() or public.is_admin() or not public.is_hidden_from_me(author_id));

create policy "Blocked members cannot comment"
  on public.comments as restrictive for insert to authenticated
  with check (public.is_admin() or not public.is_blocked_by_post_author(post_id));


-- =====================================================================
-- 4. FEEDBACK (in-app). Members can send; only admins can read.
-- Deleted together with the member's account (privacy).
-- =====================================================================
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('bug', 'confusing', 'idea', 'other')),
  message text not null check (char_length(message) between 5 and 2000),
  page text check (char_length(page) <= 200),
  status text not null default 'new' check (status in ('new', 'seen', 'done')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Members can send feedback as themselves"
  on public.feedback for insert to authenticated with check (auth.uid() = user_id);
create policy "Admins can read feedback"
  on public.feedback for select to authenticated using (public.is_admin());
create policy "Admins can update feedback"
  on public.feedback for update to authenticated using (public.is_admin());
create policy "Admins can delete feedback"
  on public.feedback for delete to authenticated using (public.is_admin());

create index feedback_created_at_idx on public.feedback (created_at desc);

-- Rate limit: 10 messages per hour per member (admins exempt).
-- SECURITY DEFINER because members cannot read the feedback table, so a
-- normal count would always return 0.
create or replace function public.limit_feedback_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if (select count(*) from public.feedback
      where user_id = new.user_id
        and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You are sending feedback too fast. Please wait a while and try again.';
  end if;
  return new;
end;
$$;

revoke execute on function public.limit_feedback_rate() from public, anon, authenticated;

create trigger feedback_rate_limit
  before insert on public.feedback
  for each row execute function public.limit_feedback_rate();