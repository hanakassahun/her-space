-- =====================================================================
-- Her Space: signup trigger (profile + invite code, enforced in the database)
--
-- READ BEFORE RUNNING. This is a BREAKING change that must be paired with
-- the new signup page code:
--   * After this runs, an account can only be created if the signup request
--     carries a valid invite_code and a display_name (2-30 characters) in
--     its metadata. The OLD signup page does not send them, so signups from
--     the old site will fail until the new code is deployed.
--   * The new signup page must NOT insert the profile itself or call
--     redeem_invite_code. The trigger does both.
--
-- Safe order: update the code locally, run this file, test signup locally,
-- push immediately, and avoid signing anyone up in between.
--
-- Users created from the Supabase dashboard ("Add user") will also be
-- rejected unless you give them display_name and invite_code metadata.
--
-- ROLLBACK (restores the old behavior):
--   drop trigger if exists on_auth_user_created on auth.users;
-- =====================================================================


-- 1. Runs inside the same transaction as the new auth user. If anything
--    raises, the whole signup is rolled back (no half-created accounts,
--    and the invite code use is not consumed).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  n integer;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 30 then
    raise exception 'Invalid display name';
  end if;

  -- Atomic: only succeeds while the code is active and has uses left.
  update public.invite_codes
     set uses = uses + 1
   where upper(code) = v_code
     and active
     and uses < max_uses;
  get diagnostics n = row_count;

  if n = 0 then
    raise exception 'Invalid invite code';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_name);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. The friendly pre-check on the signup page now ignores letter case and
--    surrounding spaces, matching the trigger.
create or replace function public.is_invite_code_valid(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invite_codes
    where upper(code) = upper(btrim(p_code))
      and active
      and uses < max_uses
  );
$$;


-- 3. Members can no longer burn invite uses: remove access to the old
--    client-callable redeem function (the trigger replaced it).
--    Drop it later, once the new signup code is live and confirmed.
revoke execute on function public.redeem_invite_code(text) from public, anon, authenticated;


-- =====================================================================
-- CHECKS (run separately, read-only)
-- =====================================================================
-- Accounts without a profile (should return 0 rows; any row is an orphan):
--   select u.id, u.email, u.created_at
--   from auth.users u
--   left join public.profiles p on p.id = u.id
--   where p.id is null;