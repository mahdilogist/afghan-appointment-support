-- Defense in depth: row-level security already blocks every direct write, but the public
-- (anon) and signed-in (authenticated) roles should not hold write privileges at all.
-- All writes go through the checked security-definer functions.
revoke all on public.requests, public.request_approvals, public.request_notes,
  public.audit_log, public.app_settings, public.user_roles from anon;
revoke insert, update, delete, truncate, references, trigger on public.requests,
  public.request_approvals, public.request_notes, public.audit_log, public.app_settings,
  public.user_roles from authenticated;

-- Visitors who are not signed in have no use for role checks; stop them probing user ids.
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Keep synthetic demo records strictly separate from real form submissions.
alter table public.requests alter column is_test_data set default false;
update public.requests set is_test_data = false where reference_code not like 'AFA-TEST-%';
alter table public.requests add constraint requests_test_data_marked
  check (is_test_data = (reference_code like 'AFA-TEST-%'));
comment on column public.requests.is_test_data is
  'TRUE only for synthetic seed records (reference AFA-TEST-xxxx). Public form submissions are always FALSE.';

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
    -- Hex characters only, so a submission can never look like an AFA-TEST- demo reference.
    v_ref := 'AFA-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-'
                    || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    exit when not exists (select 1 from public.requests where reference_code = v_ref);
  end loop;
  insert into public.requests (reference_code, full_name, phone, city, family_members, note, consent_given, language, is_test_data)
  values (v_ref, btrim(p_full_name), btrim(p_phone), btrim(p_city), p_family_members, v_note, true,
          case when p_language = 'en' then 'en' else 'fa' end, false)
  returning id into v_id;
  insert into public.audit_log (request_id, action, to_status, details)
  values (v_id, 'submitted', 'pending_review', 'Submitted via public form');
  return v_ref;
end $$;

-- Status counts split by source, so dashboards can keep demo and real records apart.
create or replace function public.admin_status_counts_by_source()
returns table (status public.request_status, is_test_data boolean, total bigint)
language sql stable security invoker set search_path = public as $$
  select r.status, r.is_test_data, count(*)::bigint from public.requests r group by r.status, r.is_test_data
$$;
revoke execute on function public.admin_status_counts_by_source() from public, anon;
grant execute on function public.admin_status_counts_by_source() to authenticated;

comment on function public.admin_status_counts() is 'DEPRECATED: replaced by admin_status_counts_by_source()';