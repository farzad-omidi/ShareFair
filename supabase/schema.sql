-- ShareFair database schema
--
-- Applied to the Supabase project as migrations (sharefair_initial_schema,
-- harden_function_permissions, settlement_confirmation_flow, payment_requests,
-- payer_can_edit_own_entries, member_active_since). This file is the reproducible,
-- combined source of truth — apply it to a fresh Supabase project's SQL editor (or
-- via `supabase db push` / the `apply_migration` MCP tool) to stand the app back up.

-- ============ profiles ============
-- Supabase provisions an "extensions" schema in every project; pin pgcrypto there
-- explicitly so create_invite's fully-qualified extensions.gen_random_bytes() call
-- resolves the same way regardless of where this file is applied.
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  palette int not null default 0,
  created_at timestamptz not null default now()
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

alter table public.space_invites enable row level security;

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
begin
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

-- ============ RLS policies ============

-- profiles: self, or anyone sharing a space with you
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.space_members sm1
      join public.space_members sm2 on sm1.space_id = sm2.space_id
      where sm1.user_id = auth.uid() and sm2.user_id = profiles.id
    )
  );

create policy profiles_update_self on public.profiles for update
  using (id = auth.uid());

-- spaces
create policy spaces_select on public.spaces for select
  using (public.is_space_member(id));

create policy spaces_update on public.spaces for update
  using (public.is_space_member(id));

create policy spaces_delete on public.spaces for delete
  using (public.is_space_owner(id));

-- space_members
create policy space_members_select on public.space_members for select
  using (public.is_space_member(space_id));

create policy space_members_update_self on public.space_members for update
  using (user_id = auth.uid());

create policy space_members_delete on public.space_members for delete
  using (user_id = auth.uid() or public.is_space_owner(space_id));

-- space_invites
create policy space_invites_select on public.space_invites for select
  using (public.is_space_member(space_id));

create policy space_invites_delete on public.space_invites for delete
  using (public.is_space_member(space_id));

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

create policy entries_insert on public.entries for insert
  with check (public.is_space_member(space_id) and created_by = auth.uid());

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
      created_by = auth.uid()
      or public.is_space_owner(space_id)
      or (kind = 'settlement' and status = 'pending' and (from_id = auth.uid() or to_id = auth.uid()))
      or (kind in ('expense', 'credit') and payer_id = auth.uid())
    )
  )
  with check (
    public.is_space_member(space_id)
    and (
      created_by = auth.uid()
      or public.is_space_owner(space_id)
      or (kind = 'settlement' and (from_id = auth.uid() or to_id = auth.uid()))
      or (kind in ('expense', 'credit') and payer_id = auth.uid())
    )
  );

create policy entries_delete on public.entries for delete
  using (
    public.is_space_member(space_id)
    and (
      created_by = auth.uid()
      or public.is_space_owner(space_id)
      or (kind = 'settlement' and status = 'pending' and (from_id = auth.uid() or to_id = auth.uid()))
      or (kind = 'request' and (from_id = auth.uid() or to_id = auth.uid()))
      or (kind in ('expense', 'credit') and payer_id = auth.uid())
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

-- ============ realtime ============
alter publication supabase_realtime add table public.entries;
alter publication supabase_realtime add table public.space_members;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.spaces;

-- ============ hardened function permissions ============
-- Internal helpers are not meant to be called directly via REST, only used inside RLS
-- policies/functions. User-facing RPCs require a signed-in user.
revoke execute on function public.is_space_member(uuid) from anon, authenticated;
revoke execute on function public.is_space_owner(uuid) from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

revoke execute on function public.create_space(text, text) from anon;
revoke execute on function public.create_invite(uuid, int, int) from anon;
revoke execute on function public.redeem_invite(text) from anon;

grant execute on function public.create_space(text, text) to authenticated;
grant execute on function public.create_invite(uuid, int, int) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
