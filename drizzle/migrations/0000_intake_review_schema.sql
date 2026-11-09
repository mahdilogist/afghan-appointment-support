-- ========== Enums ==========
create type public.app_role as enum ('admin', 'applicant');
create type public.request_status as enum (
  'pending_review', 'needs_clarification', 'approved', 'in_progress', 'completed', 'rejected'
);

-- ========== Roles ==========
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users can read their own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public._require_admin()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.has_role(v_uid, 'admin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return v_uid;
end $$;
revoke execute on function public._require_admin() from public, anon, authenticated;

-- ========== Settings (single row) ==========
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  -- NULL means the project owner has not chosen an approval policy yet.
  approval_policy text check (approval_policy in ('single_admin', 'two_person')),
  queue_order text not null default 'oldest_first' check (queue_order in ('oldest_first', 'newest_first')),
  -- NULL means no retention period chosen yet (placeholder; nothing is deleted automatically).
  retention_days integer check (retention_days is null or retention_days between 30 and 3650),
  -- On-demand automation placeholder: locked OFF in this MVP. No worker or job exists.
  automation_enabled boolean not null default false check (automation_enabled = false),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "Admins can read settings" on public.app_settings
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
insert into public.app_settings (id) values (1);

-- ========== Requests ==========
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^\+?[0-9][0-9 ()-]{6,19}$'),
  city text not null check (char_length(city) between 2 and 80),
  family_members integer not null check (family_members between 1 and 20),
  note text check (note is null or char_length(note) <= 500),
  consent_given boolean not null check (consent_given = true),
  language text not null default 'fa' check (language in ('fa', 'en')),
  status public.request_status not null default 'pending_review',
  is_test_data boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index requests_status_created_idx on public.requests (status, created_at);
create index requests_created_idx on public.requests (created_at);
grant select on public.requests to authenticated;
grant all on public.requests to service_role;
alter table public.requests enable row level security;
create policy "Admins can read requests" on public.requests
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger requests_touch_updated_at before update on public.requests
  for each row execute function public.touch_updated_at();

-- ========== Approvals ==========
create table public.request_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  admin_id uuid not null,
  admin_email text,
  created_at timestamptz not null default now(),
  unique (request_id, admin_id)
);
grant select on public.request_approvals to authenticated;
grant all on public.request_approvals to service_role;
alter table public.request_approvals enable row level security;
create policy "Admins can read approvals" on public.request_approvals
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ========== Internal notes ==========
create table public.request_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  author_id uuid,
  author_email text,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index request_notes_request_idx on public.request_notes (request_id, created_at);
grant select on public.request_notes to authenticated;
grant all on public.request_notes to service_role;
alter table public.request_notes enable row level security;
create policy "Admins can read notes" on public.request_notes
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ========== Audit trail ==========
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete set null,
  actor_id uuid,
  actor_email text,
  action text not null,
  from_status public.request_status,
  to_status public.request_status,
  details text,
  created_at timestamptz not null default now()
);
create index audit_log_request_idx on public.audit_log (request_id, created_at);
create index audit_log_created_idx on public.audit_log (created_at);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "Admins can read audit log" on public.audit_log
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ========== Public submission (insert-only, returns reference) ==========
create or replace function public.submit_request(
  p_full_name text, p_phone text, p_city text, p_family_members integer,
  p_note text, p_consent boolean, p_language text
) returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_ref text;
  v_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_consent is not true then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  loop
    v_ref := 'AFA-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-'
                    || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    exit when not exists (select 1 from public.requests where reference_code = v_ref);
  end loop;
  insert into public.requests (reference_code, full_name, phone, city, family_members, note, consent_given, language, is_test_data)
  values (v_ref, btrim(p_full_name), btrim(p_phone), btrim(p_city), p_family_members, v_note, true,
          case when p_language = 'en' then 'en' else 'fa' end, true)
  returning id into v_id;
  insert into public.audit_log (request_id, action, to_status, details)
  values (v_id, 'submitted', 'pending_review', 'Submitted via public form');
  return v_ref;
end $$;
revoke execute on function public.submit_request(text, text, text, integer, text, boolean, text) from public;
grant execute on function public.submit_request(text, text, text, integer, text, boolean, text) to anon, authenticated;

-- ========== Admin actions ==========
create or replace function public.admin_approve(p_request_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := public._require_admin();
  v_email text := auth.jwt() ->> 'email';
  v_policy text;
  v_from public.request_status;
  v_required integer;
  v_count integer;
begin
  select approval_policy into v_policy from public.app_settings where id = 1;
  if v_policy is null then
    raise exception 'approval_policy_not_set' using errcode = '22023';
  end if;
  select status into v_from from public.requests where id = p_request_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_from not in ('pending_review', 'needs_clarification') then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  if exists (select 1 from public.request_approvals where request_id = p_request_id and admin_id = v_uid) then
    raise exception 'already_approved_by_you' using errcode = '22023';
  end if;
  insert into public.request_approvals (request_id, admin_id, admin_email) values (p_request_id, v_uid, v_email);
  v_required := case v_policy when 'two_person' then 2 else 1 end;
  select count(*) into v_count from public.request_approvals where request_id = p_request_id;
  if v_count >= v_required then
    update public.requests set status = 'approved' where id = p_request_id;
    insert into public.audit_log (request_id, actor_id, actor_email, action, from_status, to_status, details)
    values (p_request_id, v_uid, v_email, 'approved', v_from, 'approved',
            format('Approval %s of %s (%s policy)', v_count, v_required, v_policy));
    return jsonb_build_object('status', 'approved', 'approvals', v_count, 'required', v_required);
  end if;
  insert into public.audit_log (request_id, actor_id, actor_email, action, from_status, to_status, details)
  values (p_request_id, v_uid, v_email, 'approval_recorded', v_from, v_from,
          format('Approval %s of %s (%s policy)', v_count, v_required, v_policy));
  return jsonb_build_object('status', v_from, 'approvals', v_count, 'required', v_required);
end $$;

create or replace function public.admin_set_status(
  p_request_id uuid, p_status public.request_status, p_reason text default null
) returns public.request_status language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := public._require_admin();
  v_email text := auth.jwt() ->> 'email';
  v_from public.request_status;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;
  select status into v_from from public.requests where id = p_request_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (
       (p_status = 'needs_clarification' and v_from = 'pending_review')
    or (p_status = 'pending_review' and v_from = 'needs_clarification')
    or (p_status = 'rejected' and v_from in ('pending_review', 'needs_clarification', 'approved'))
    or (p_status = 'in_progress' and v_from = 'approved')
    or (p_status = 'completed' and v_from in ('approved', 'in_progress'))
  ) then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  update public.requests set status = p_status where id = p_request_id;
  if p_status in ('needs_clarification', 'rejected', 'pending_review') then
    delete from public.request_approvals where request_id = p_request_id;
  end if;
  insert into public.audit_log (request_id, actor_id, actor_email, action, from_status, to_status, details)
  values (p_request_id, v_uid, v_email, 'status_changed', v_from, p_status, v_reason);
  return p_status;
end $$;

create or replace function public.admin_add_note(p_request_id uuid, p_body text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := public._require_admin();
  v_email text := auth.jwt() ->> 'email';
  v_id uuid;
begin
  if not exists (select 1 from public.requests where id = p_request_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.request_notes (request_id, author_id, author_email, body)
  values (p_request_id, v_uid, v_email, btrim(p_body)) returning id into v_id;
  insert into public.audit_log (request_id, actor_id, actor_email, action, details)
  values (p_request_id, v_uid, v_email, 'note_added', 'Internal note added');
  return v_id;
end $$;

create or replace function public.admin_update_settings(
  p_approval_policy text, p_queue_order text, p_retention_days integer
) returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := public._require_admin();
  v_email text := auth.jwt() ->> 'email';
  v_old public.app_settings;
  v_changes text[] := '{}';
  v_policy text := nullif(p_approval_policy, '');
begin
  select * into v_old from public.app_settings where id = 1 for update;
  if v_old.approval_policy is distinct from v_policy then
    v_changes := v_changes || format('approval_policy: %s -> %s', coalesce(v_old.approval_policy, 'unset'), coalesce(v_policy, 'unset'));
  end if;
  if v_old.queue_order is distinct from p_queue_order then
    v_changes := v_changes || format('queue_order: %s -> %s', v_old.queue_order, p_queue_order);
  end if;
  if v_old.retention_days is distinct from p_retention_days then
    v_changes := v_changes || format('retention_days: %s -> %s', coalesce(v_old.retention_days::text, 'unset'), coalesce(p_retention_days::text, 'unset'));
  end if;
  if array_length(v_changes, 1) is null then return; end if;
  update public.app_settings
    set approval_policy = v_policy, queue_order = p_queue_order, retention_days = p_retention_days,
        updated_at = now(), updated_by = v_uid
    where id = 1;
  insert into public.audit_log (actor_id, actor_email, action, details)
  values (v_uid, v_email, 'settings_updated', array_to_string(v_changes, '; '));
end $$;

create or replace function public.admin_status_counts()
returns table (status public.request_status, total bigint)
language sql stable security invoker set search_path = public as $$
  select r.status, count(*)::bigint from public.requests r group by r.status
$$;

revoke execute on function public.admin_approve(uuid) from public, anon;
revoke execute on function public.admin_set_status(uuid, public.request_status, text) from public, anon;
revoke execute on function public.admin_add_note(uuid, text) from public, anon;
revoke execute on function public.admin_update_settings(text, text, integer) from public, anon;
revoke execute on function public.admin_status_counts() from public, anon;
grant execute on function public.admin_approve(uuid) to authenticated;
grant execute on function public.admin_set_status(uuid, public.request_status, text) to authenticated;
grant execute on function public.admin_add_note(uuid, text) to authenticated;
grant execute on function public.admin_update_settings(text, text, integer) to authenticated;
grant execute on function public.admin_status_counts() to authenticated;

-- ========== Synthetic demo data (TEST DATA ONLY — fictional people, +93 700 000 xxx numbers) ==========
insert into public.requests (id, reference_code, full_name, phone, city, family_members, note, consent_given, language, status, is_test_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000001', 'AFA-TEST-0001', 'فریده احمدی', '+93 700 000 101', 'کابل', 3, 'نمونهٔ آزمایشی — مادر و دو فرزند.', true, 'fa', 'pending_review', true, now() - interval '9 days', now() - interval '9 days'),
  ('00000000-0000-4000-8000-000000000002', 'AFA-TEST-0002', 'محمد نادر کریمی', '+93 700 000 102', 'هرات', 1, null, true, 'fa', 'pending_review', true, now() - interval '7 days', now() - interval '7 days'),
  ('00000000-0000-4000-8000-000000000003', 'AFA-TEST-0003', 'Zahra Hosseini', '+93 700 000 103', 'Mazar-i-Sharif', 2, 'Test record. Prefers morning calls.', true, 'en', 'needs_clarification', true, now() - interval '12 days', now() - interval '10 days'),
  ('00000000-0000-4000-8000-000000000004', 'AFA-TEST-0004', 'عبدالله رحیمی', '+93 700 000 104', 'جلال‌آباد', 4, null, true, 'fa', 'approved', true, now() - interval '15 days', now() - interval '13 days'),
  ('00000000-0000-4000-8000-000000000005', 'AFA-TEST-0005', 'Mariam Sultani', '+93 700 000 105', 'Kabul', 2, null, true, 'en', 'in_progress', true, now() - interval '20 days', now() - interval '16 days'),
  ('00000000-0000-4000-8000-000000000006', 'AFA-TEST-0006', 'حمید نوری', '+93 700 000 106', 'بامیان', 1, null, true, 'fa', 'completed', true, now() - interval '30 days', now() - interval '22 days'),
  ('00000000-0000-4000-8000-000000000007', 'AFA-TEST-0007', 'نسرین یوسفی', '+93 700 000 107', 'قندهار', 1, 'درخواست تکراری (آزمایشی).', true, 'fa', 'rejected', true, now() - interval '25 days', now() - interval '24 days'),
  ('00000000-0000-4000-8000-000000000008', 'AFA-TEST-0008', 'Ahmad Shah Wardak', '+93 700 000 108', 'Kabul', 5, null, true, 'en', 'pending_review', true, now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000009', 'AFA-TEST-0009', 'سمیه حیدری', '+93 700 000 109', 'هرات', 2, 'شماره تماس فقط عصرها در دسترس است.', true, 'fa', 'pending_review', true, now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000010', 'AFA-TEST-0010', 'Karim Jalali', '+93 700 000 110', 'Kunduz', 3, null, true, 'en', 'pending_review', true, now() - interval '4 days', now() - interval '4 days');

insert into public.audit_log (request_id, actor_email, action, from_status, to_status, details, created_at)
select id, null, 'submitted', null, 'pending_review', 'Synthetic seed record', created_at from public.requests where is_test_data;

insert into public.audit_log (request_id, actor_email, action, from_status, to_status, details, created_at) values
  ('00000000-0000-4000-8000-000000000003', 'demo-seed', 'status_changed', 'pending_review', 'needs_clarification', 'City spelling unclear (synthetic example)', now() - interval '10 days'),
  ('00000000-0000-4000-8000-000000000004', 'demo-seed', 'approved', 'pending_review', 'approved', 'Synthetic seed example', now() - interval '13 days'),
  ('00000000-0000-4000-8000-000000000005', 'demo-seed', 'approved', 'pending_review', 'approved', 'Synthetic seed example', now() - interval '18 days'),
  ('00000000-0000-4000-8000-000000000005', 'demo-seed', 'status_changed', 'approved', 'in_progress', null, now() - interval '16 days'),
  ('00000000-0000-4000-8000-000000000006', 'demo-seed', 'approved', 'pending_review', 'approved', 'Synthetic seed example', now() - interval '27 days'),
  ('00000000-0000-4000-8000-000000000006', 'demo-seed', 'status_changed', 'approved', 'completed', null, now() - interval '22 days'),
  ('00000000-0000-4000-8000-000000000007', 'demo-seed', 'status_changed', 'pending_review', 'rejected', 'Duplicate of another request (synthetic example)', now() - interval '24 days');

insert into public.request_notes (request_id, author_email, body, created_at) values
  ('00000000-0000-4000-8000-000000000003', 'demo-seed', 'Synthetic note: asked applicant to confirm city name.', now() - interval '10 days'),
  ('00000000-0000-4000-8000-000000000005', 'demo-seed', 'Synthetic note: volunteer is preparing appointment guidance.', now() - interval '16 days');