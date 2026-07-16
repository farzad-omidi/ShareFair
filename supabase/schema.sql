-- ShareFair database schema
--
-- Applied to the Supabase project as migrations (sharefair_initial_schema,
-- harden_function_permissions, settlement_confirmation_flow, payment_requests,
-- payer_can_edit_own_entries, member_active_since, space_invitations,
-- space_invitations_visible_space_name, space_invitations_hardening,
-- free_tier_space_limit, space_owner_edit_permissions). This file is the
-- reproducible, combined source of truth — apply it to a fresh Supabase
-- project's SQL editor (or via `supabase db push` / the `apply_migration`
-- MCP tool) to stand the app back up.

-- ============ profiles ============
-- Supabase provisions an "extensions" schema in every project; pin pgcrypto there
-- explicitly so create_invite's fully-qualified extensions.gen_random_bytes() call
-- resolves the same way regardless of where this file is applied.
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  palette int not null default 0,
  created_at timestamptz not null default now(),
  -- Lifts the free tier's one-owned-space limit (see create_space()). Still no
  -- real payment processor behind this -- set by the tryout unlock_account() RPC,
  -- same "preview" spirit as the rest of the unlock flow.
  unlocked boolean not null default false
);

alter table public.profiles enable row level security;

-- ============ spaces ============
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'EUR',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists spaces_created_by_idx on public.spaces(created_by);
alter table public.spaces enable row level security;

-- ============ space_members ============
create table public.space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  palette int not null default 0,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  -- Since when this member actually considers themselves involved in the space's
  -- shared expenses -- distinct from joined_at, which is just when they redeemed an
  -- invite. Null means "not asked yet" (only true for a brand-new join; existing
  -- rows get backfilled to joined_at, and a space's own creator gets it set to the
  -- creation date directly).
  active_since date,
  unique (space_id, user_id)
);

create index if not exists space_members_user_id_idx on public.space_members(user_id);
alter table public.space_members enable row level security;

-- ============ space_invites ============
create table public.space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id),
  max_uses int,
  uses int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists space_invites_space_id_idx on public.space_invites(space_id);
create index if not exists space_invites_created_by_idx on public.space_invites(created_by);
alter table public.space_invites enable row level security;

-- ============ space_invitations ============
-- A directed, in-app invitation to a specific user to join a specific space,
-- distinct from space_invites (anonymous, code-based, no named target).
create table public.space_invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- Prevents duplicate pending invites to the same person for the same space,
-- while still allowing a new invite to be sent after a decline (or after an
-- earlier invite was accepted and, hypothetically, the member later left).
create unique index space_invitations_unique_pending
  on public.space_invitations (space_id, invited_user_id)
  where status = 'pending';

alter table public.space_invitations enable row level security;

-- ============ categories ============
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null,
  grp text not null default 'daily' check (grp in ('daily','housing')),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists categories_space_id_idx on public.categories(space_id);
alter table public.categories enable row level security;

-- ============ entries (expenses, credits, settlements, and payment requests) ============
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  kind text not null check (kind in ('expense','credit','settlement','request')),
  payer_id uuid references public.profiles(id),
  from_id uuid references public.profiles(id),
  to_id uuid references public.profiles(id),
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  entry_date date not null,
  month text not null,
  note text,
  participant_ids uuid[] not null default '{}',
  split_type text not null default 'equal' check (split_type in ('equal','percent','shares','amounts')),
  split_values jsonb not null default '{}'::jsonb,
  recurring boolean not null default false,
  -- Only meaningful for settlements: a settlement starts 'pending' and only counts
  -- toward balances once the other party confirms it. Expenses/credits and legacy
  -- settlements are 'confirmed' by default (no approval step applies to them).
  status text not null default 'confirmed' check (status in ('pending','confirmed')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A 'request' is a nudge from whoever's owed money ("please pay me") -- it never
  -- claims payment already happened, so it never counts toward balances and can only
  -- be created by the person it names as owed (to_id), naming no payer.
  constraint entries_request_shape_check check (
    kind <> 'request'
    or (created_by = to_id and from_id is not null and to_id is not null and payer_id is null)
  )
);

create index entries_space_month_idx on public.entries(space_id, month);
-- Covering indexes for entries' foreign keys (payer/from/to/category/created_by),
-- flagged by the performance advisor as unindexed -- these are hit on every balance
-- calculation, entry list, and lookup by author.
create index if not exists entries_payer_id_idx on public.entries(payer_id);
create index if not exists entries_from_id_idx on public.entries(from_id);
create index if not exists entries_to_id_idx on public.entries(to_id);
create index if not exists entries_category_id_idx on public.entries(category_id);
create index if not exists entries_created_by_idx on public.entries(created_by);
alter table public.entries enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- ============ helper: membership check (security definer avoids RLS recursion) ============
create or replace function public.is_space_member(p_space_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_space_owner(p_space_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ============ profiles auto-create on signup ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ RPC: create_space ============
-- Creates a space, adds the caller as owner, and seeds a starter category set.
create or replace function public.create_space(p_name text, p_currency text default 'EUR')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_display_name text;
  v_owns_a_space boolean;
  v_unlocked boolean;
begin
  -- Free tier: one owned space per account. Doesn't limit how many spaces you can
  -- be a MEMBER of (joining someone else's space is always unrestricted, so the
  -- core invite-your-friends loop never requires anyone to pay), only how many you
  -- can personally create. `unlocked` lifts this once set (see unlock_account()).
  select exists(select 1 from public.spaces where created_by = auth.uid()) into v_owns_a_space;
  select coalesce(unlocked, false) into v_unlocked from public.profiles where id = auth.uid();
  if v_owns_a_space and not v_unlocked then
    raise exception 'free_space_limit';
  end if;

  insert into public.spaces (name, currency, created_by) values (p_name, p_currency, auth.uid()) returning id into v_space_id;

  select display_name into v_display_name from public.profiles where id = auth.uid();

  insert into public.space_members (space_id, user_id, display_name, palette, role, active_since)
  values (v_space_id, auth.uid(), coalesce(v_display_name, 'You'), 0, 'owner', now()::date);

  insert into public.categories (space_id, name, grp, sort_order) values
    (v_space_id,'Groceries','daily',1),
    (v_space_id,'Eating out','daily',2),
    (v_space_id,'Rent','housing',3),
    (v_space_id,'Energy','daily',4),
    (v_space_id,'Internet','daily',5),
    (v_space_id,'Household','daily',6),
    (v_space_id,'Transport','daily',7),
    (v_space_id,'Fun & culture','daily',8);

  return v_space_id;
end;
$$;

-- ============ RPC: create_invite ============
-- Generates a short, unguessable invite code for the given space (caller must be a
-- member), retrying on the (rare) short-code collision.
create or replace function public.create_invite(p_space_id uuid, p_max_uses int default null, p_expires_in_days int default 14)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_attempt int := 0;
begin
  if not public.is_space_member(p_space_id) then
    raise exception 'Not a member of this space';
  end if;

  loop
    v_attempt := v_attempt + 1;
    -- pgcrypto lives in the "extensions" schema on Supabase projects, not "public" --
    -- fully qualify so it resolves regardless of search_path.
    v_code := substr(lower(regexp_replace(encode(extensions.gen_random_bytes(8), 'base64'), '[^a-zA-Z0-9]', '', 'g')), 1, 8);
    begin
      insert into public.space_invites (space_id, code, created_by, max_uses, expires_at)
      values (
        p_space_id, v_code, auth.uid(), p_max_uses,
        case when p_expires_in_days is null then null else now() + (p_expires_in_days || ' days')::interval end
      );
      return v_code;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'Could not generate a unique invite code, please try again';
      end if;
    end;
  end loop;
end;
$$;

-- ============ RPC: redeem_invite ============
-- Joins the caller to the invite's space, enforcing expiry/use-limit, idempotently.
create or replace function public.redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_display_name text;
  v_next_palette int;
begin
  select * into v_invite from public.space_invites where code = p_code for update;
  if not found then
    raise exception 'Invalid invite code';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'This invite has expired';
  end if;
  if v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses then
    raise exception 'This invite has reached its use limit';
  end if;

  select display_name into v_display_name from public.profiles where id = auth.uid();
  select coalesce(count(*),0)::int into v_next_palette from public.space_members where space_id = v_invite.space_id;

  insert into public.space_members (space_id, user_id, display_name, palette, role)
  values (v_invite.space_id, auth.uid(), coalesce(v_display_name,'New member'), v_next_palette % 8, 'member')
  on conflict (space_id, user_id) do nothing;

  update public.space_invites set uses = uses + 1 where id = v_invite.id;

  return v_invite.space_id;
end;
$$;

-- ============ RPC: unlock_account ============
-- Lifts the free tier's one-owned-space limit for the caller. No real payment
-- processor exists yet -- this is the same "tryout" preview as the rest of the
-- unlock flow, just now backed by a real, persisted, enforced state instead of
-- being purely cosmetic.
create or replace function public.unlock_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set unlocked = true where id = auth.uid();
end;
$$;

-- ============ RPC: respond_to_space_invitation ============
-- Accepts or declines a pending invitation directed at the caller. On accept,
-- also adds the caller as a space member (mirroring create_space's own
-- membership insert), idempotently in case of a race.
create or replace function public.respond_to_space_invitation(p_invitation_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_display_name text;
begin
  select * into v_invite from public.space_invitations where id = p_invitation_id for update;

  if not found or v_invite.invited_user_id <> auth.uid() or v_invite.status <> 'pending' then
    raise exception 'Invitation not found or already responded to';
  end if;

  update public.space_invitations
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_invitation_id;

  if p_accept then
    select display_name into v_display_name from public.profiles where id = auth.uid();

    insert into public.space_members (space_id, user_id, display_name, palette, role, active_since)
    values (v_invite.space_id, auth.uid(), coalesce(v_display_name, 'New member'), 0, 'member', now()::date)
    on conflict (space_id, user_id) do nothing;
  end if;
end;
$$;

-- ============ RLS policies ============

-- profiles: self, or anyone sharing a space with you
-- auth.uid() is wrapped in (select ...) throughout these policies so Postgres can
-- evaluate it once per query instead of re-evaluating it per row (auth_rls_initplan).
create policy profiles_select on public.profiles for select
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.space_members sm1
      join public.space_members sm2 on sm1.space_id = sm2.space_id
      where sm1.user_id = (select auth.uid()) and sm2.user_id = profiles.id
    )
  );

create policy profiles_update_self on public.profiles for update
  using (id = (select auth.uid()));

-- An invitee needs to see the inviter's display name before accepting --
-- profiles_select only covers people who already share a space, which isn't
-- yet true for a brand-new-space invite. This is a second, additive SELECT
-- policy scoped strictly to the two parties of an active pending invitation
-- between them (works both directions, so the inviter can also see who they
-- invited).
create policy profiles_select_invited on public.profiles for select
  using (
    exists (
      select 1 from public.space_invitations
      where status = 'pending'
        and (
          (invited_by = profiles.id and invited_user_id = (select auth.uid()))
          or (invited_user_id = profiles.id and invited_by = (select auth.uid()))
        )
    )
  );

-- spaces
create policy spaces_select on public.spaces for select
  using (public.is_space_member(id));

-- An invitee needs to see the name of a space they've been invited to before
-- they've joined it (e.g. to render "Join Trip" in their pending-invitations
-- list) -- this is a second, additive SELECT policy (Postgres combines
-- same-command RLS policies with OR), scoped strictly to spaces with a pending
-- invitation naming the caller.
create policy spaces_select_invited on public.spaces for select
  using (
    exists (
      select 1 from public.space_invitations
      where space_id = spaces.id
        and invited_user_id = (select auth.uid())
        and status = 'pending'
    )
  );

-- owner-only: space-level settings (name, currency) are the owner's call,
-- matching spaces_delete's existing scope
create policy spaces_update on public.spaces for update
  using (public.is_space_owner(id));

create policy spaces_delete on public.spaces for delete
  using (public.is_space_owner(id));

-- space_members
create policy space_members_select on public.space_members for select
  using (public.is_space_member(space_id));

create policy space_members_update_self on public.space_members for update
  using (user_id = (select auth.uid()));

-- lets the space owner edit another member's display_name/palette too (not
-- just their own row) -- role/space_id/user_id stay immutable regardless of
-- who updates, via the protect_space_membership_columns trigger below
create policy space_members_update_owner on public.space_members for update
  using (public.is_space_owner(space_id));

create policy space_members_delete on public.space_members for delete
  using (user_id = (select auth.uid()) or public.is_space_owner(space_id));

-- space_invites
create policy space_invites_select on public.space_invites for select
  using (public.is_space_member(space_id));

create policy space_invites_delete on public.space_invites for delete
  using (public.is_space_member(space_id));

-- space_invitations: the invitee can see their own invitations; any member of the
-- target space can also see invitations issued for it.
create policy space_invitations_select on public.space_invitations for select
  using (
    invited_user_id = (select auth.uid())
    or public.is_space_member(space_id)
  );

-- caller must already be a member of the space, must be the one recorded as
-- inviting, and cannot invite themselves.
create policy space_invitations_insert on public.space_invitations for insert
  with check (
    public.is_space_member(space_id)
    and invited_by = (select auth.uid())
    and invited_user_id <> (select auth.uid())
  );

-- only the invitee may respond, and only while still pending -- this keeps the
-- inviter (or anyone else) from tampering with the response status.
create policy space_invitations_update on public.space_invitations for update
  using (
    invited_user_id = (select auth.uid())
    and status = 'pending'
  );

-- categories
create policy categories_select on public.categories for select
  using (public.is_space_member(space_id));

create policy categories_insert on public.categories for insert
  with check (public.is_space_member(space_id));

create policy categories_update on public.categories for update
  using (public.is_space_member(space_id));

create policy categories_delete on public.categories for delete
  using (public.is_space_member(space_id));

-- entries
create policy entries_select on public.entries for select
  using (public.is_space_member(space_id));

-- Beyond membership + authorship, insert is further restricted per kind so a client
-- can't bypass the app's two-party settlement confirmation flow by inserting an
-- already-confirmed settlement (or a request not tied to the actual payee) directly
-- via the REST API:
--   * settlement: must start 'pending'. Deliberately does NOT require auth.uid() to
--     be from_id/to_id -- the app's SettleView lets any space member record that two
--     other members settled up (verified against live data: a meaningful share of
--     existing settlement rows were created by a third party), and that recording is
--     inert until confirmed by the actual from_id/to_id party via entries_update +
--     protect_entry_columns, which already restrict who can flip status to
--     'confirmed'.
--   * request: to_id must be the caller. This mirrors (and is already fully
--     guaranteed by) the entries_request_shape_check CHECK constraint below, which
--     requires created_by = to_id for every request row -- listed here explicitly as
--     a defense-in-depth RLS guard, not a new restriction. Deliberately does NOT
--     require status = 'pending': requestPayment() never sets status (it defaults to
--     'confirmed'), and a request's status is never consulted for balances anyway.
--   * expense/credit: unrestricted beyond is_space_member + created_by = auth.uid()
--     (unchanged) -- payer/participant semantics for these kinds are intentionally
--     flexible, since anyone in the space can log an expense paid by anyone.
create policy entries_insert on public.entries for insert
  with check (
    public.is_space_member(space_id)
    and created_by = (select auth.uid())
    and (
      kind in ('expense', 'credit')
      or (kind = 'settlement' and status = 'pending')
      or (kind = 'request' and to_id = (select auth.uid()))
    )
  );

-- Only the entry's author or the space owner may edit/delete it (not any member) --
-- except that either party to a *pending* settlement may also update it (to
-- confirm/decline) or delete it (to decline, or to cancel their own request), and
-- the person an expense/credit is attributed to (payer_id) may fully edit/delete it
-- too, since someone else may have logged it on their behalf and gotten a detail
-- wrong. The protect_entry_columns trigger further restricts a non-author/owner,
-- non-payer update to touching only the status field.
create policy entries_update on public.entries for update
  using (
    public.is_space_member(space_id)
    and (
      created_by = (select auth.uid())
      or public.is_space_owner(space_id)
      or (kind = 'settlement' and status = 'pending' and (from_id = (select auth.uid()) or to_id = (select auth.uid())))
      or (kind in ('expense', 'credit') and payer_id = (select auth.uid()))
    )
  )
  with check (
    public.is_space_member(space_id)
    and (
      created_by = (select auth.uid())
      or public.is_space_owner(space_id)
      or (kind = 'settlement' and (from_id = (select auth.uid()) or to_id = (select auth.uid())))
      or (kind in ('expense', 'credit') and payer_id = (select auth.uid()))
    )
  );

create policy entries_delete on public.entries for delete
  using (
    public.is_space_member(space_id)
    and (
      created_by = (select auth.uid())
      or public.is_space_owner(space_id)
      or (kind = 'settlement' and status = 'pending' and (from_id = (select auth.uid()) or to_id = (select auth.uid())))
      or (kind = 'request' and (from_id = (select auth.uid()) or to_id = (select auth.uid())))
      or (kind in ('expense', 'credit') and payer_id = (select auth.uid()))
    )
  );

-- ============ immutable columns (defense in depth) ============
-- RLS UPDATE policies without WITH CHECK reuse the USING clause for the new row too,
-- and even a matching WITH CHECK can't compare old vs new column values on its own --
-- so column immutability (role/space_id/user_id/created_by) is enforced with BEFORE
-- UPDATE triggers, closing privilege-escalation and tenant-isolation gaps that RLS
-- policies alone can't.

create or replace function public.protect_space_membership_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.space_id is distinct from old.space_id
     or new.user_id is distinct from old.user_id
     or new.role is distinct from old.role then
    raise exception 'Cannot change space_id, user_id, or role of a membership';
  end if;
  return new;
end;
$$;

create trigger space_members_protect_columns
  before update on public.space_members
  for each row execute function public.protect_space_membership_columns();

create or replace function public.protect_entry_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.space_id is distinct from old.space_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Cannot move an entry to a different space or change its author';
  end if;

  -- A confirmed settlement is final: it can never be reopened.
  if old.status = 'confirmed' and new.status is distinct from old.status then
    raise exception 'A confirmed settlement cannot be reopened';
  end if;

  -- Anyone other than the entry's author/space owner (i.e. the counterparty to a
  -- pending settlement, per the RLS policy below) may only flip that settlement's
  -- status -- never touch what actually moved.
  if auth.uid() <> old.created_by and not public.is_space_owner(old.space_id) then
    -- The person an expense/credit is attributed to may fully edit it, same as
    -- whoever originally logged it.
    if old.kind in ('expense', 'credit') and auth.uid() = old.payer_id then
      return new;
    end if;
    if old.kind <> 'settlement' or old.status <> 'pending' then
      raise exception 'Not allowed to edit this entry';
    end if;
    if new.amount is distinct from old.amount
       or new.from_id is distinct from old.from_id
       or new.to_id is distinct from old.to_id
       or new.kind is distinct from old.kind
       or new.entry_date is distinct from old.entry_date
       or new.participant_ids is distinct from old.participant_ids
       or new.category_id is distinct from old.category_id
       or new.note is distinct from old.note
       or new.split_type is distinct from old.split_type
       or new.split_values is distinct from old.split_values
       or new.recurring is distinct from old.recurring then
      raise exception 'Can only confirm or decline this settlement';
    end if;
  end if;

  return new;
end;
$$;

create trigger entries_protect_columns
  before update on public.entries
  for each row execute function public.protect_entry_columns();

create or replace function public.protect_category_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.space_id is distinct from old.space_id then
    raise exception 'Cannot move a category to a different space';
  end if;
  return new;
end;
$$;

create trigger categories_protect_columns
  before update on public.categories
  for each row execute function public.protect_category_columns();

-- The space_invitations_update RLS policy has a USING clause but no WITH
-- CHECK, so Postgres reuses USING as the check on the new row too -- meaning
-- it only constrains invited_user_id/status, leaving space_id, invited_by, and
-- created_at free for the invitee to rewrite on their own row. A WITH CHECK
-- alone can't compare old vs new column values, so this is closed the same
-- way as the tables above: a BEFORE UPDATE trigger.
create or replace function public.protect_space_invitation_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.space_id is distinct from old.space_id
     or new.invited_user_id is distinct from old.invited_user_id
     or new.invited_by is distinct from old.invited_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Cannot change space_id, invited_user_id, invited_by, or created_at of an invitation';
  end if;
  return new;
end;
$$;

create trigger space_invitations_protect_columns
  before update on public.space_invitations
  for each row execute function public.protect_space_invitation_columns();

-- ============ realtime ============
alter publication supabase_realtime add table public.entries;
alter publication supabase_realtime add table public.space_members;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.spaces;
alter publication supabase_realtime add table public.space_invitations;

-- ============ hardened function permissions ============
-- Postgres grants EXECUTE to PUBLIC by default when a function is created, and that
-- default is what actually made these callable by anon -- revoking from anon/
-- authenticated directly is a no-op while PUBLIC still holds the grant (anon and
-- authenticated inherit it through PUBLIC either way). So revoke from PUBLIC first,
-- which removes it from every role including anon, then re-grant to authenticated
-- only where a signed-in user genuinely needs to call it:
--   * is_space_member / is_space_owner are referenced inside nearly every RLS policy
--     below -- Postgres requires the *querying* role to hold EXECUTE on a function
--     used in a policy even though the function itself is SECURITY DEFINER, so these
--     must stay executable by authenticated for RLS to work at all. They still must
--     not be callable by anon.
--   * handle_new_user is only ever invoked by the on_auth_user_created trigger, never
--     called directly by a client role, so no role needs a direct EXECUTE grant on it.
--   * create_space / create_invite / redeem_invite / unlock_account are the app's
--     own user-facing RPCs and must stay callable by authenticated; anon must not
--     be able to call them. (respond_to_space_invitation is the same kind of RPC
--     but isn't in this from-public batch -- see the note by its own revoke
--     statement below.)
revoke execute on function public.is_space_member(uuid) from public;
revoke execute on function public.is_space_owner(uuid) from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.create_space(text, text) from public;
revoke execute on function public.create_invite(uuid, int, int) from public;
revoke execute on function public.redeem_invite(text) from public;
revoke execute on function public.unlock_account() from public;
-- NOTE: this one is intentionally still "from anon" rather than "from public" like the
-- others above -- it reflects what's ACTUALLY live right now (applied by an earlier,
-- separate migration before the public-vs-anon distinction above was understood), not an
-- aspirational fix. It very likely has the same PUBLIC-inherited-grant gap the other six
-- functions had. Follow-up needed: revoke from public + re-grant to authenticated, same as
-- the others, once Supabase tooling access is available again (blocked mid-session by a
-- persistent MCP approval-gate issue).
revoke execute on function public.respond_to_space_invitation(uuid, boolean) from anon;

grant execute on function public.is_space_member(uuid) to authenticated;
grant execute on function public.is_space_owner(uuid) to authenticated;
grant execute on function public.create_space(text, text) to authenticated;
grant execute on function public.create_invite(uuid, int, int) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.unlock_account() to authenticated;
grant execute on function public.respond_to_space_invitation(uuid, boolean) to authenticated;
