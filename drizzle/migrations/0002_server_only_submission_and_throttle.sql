-- Public submissions now go only through the app server (service role). Nobody can call the
-- submission function directly with the public key, so the server-side honeypot, validation
-- and throttle cannot be bypassed.

-- Short-lived throttle buckets. client_hash is a keyed, daily-rotating HMAC computed on the
-- server; raw IP addresses are never sent to or stored in the database. Rows older than two
-- hours are removed on every submission.
create table public.submission_throttle (
  id bigint generated always as identity primary key,
  client_hash text not null check (client_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index submission_throttle_hash_idx on public.submission_throttle (client_hash, created_at);
create index submission_throttle_created_idx on public.submission_throttle (created_at);
revoke all on public.submission_throttle from public, anon, authenticated;
grant all on public.submission_throttle to service_role;
alter table public.submission_throttle enable row level security;
comment on table public.submission_throttle is
  'Privacy-preserving submission throttle: keyed daily-rotating hashes only, kept for at most ~2 hours. No raw IPs.';

drop function if exists public.submit_request(text, text, text, integer, text, boolean, text);

create function public.submit_request(
  p_full_name text, p_phone text, p_city text, p_family_members integer,
  p_note text, p_consent boolean, p_language text, p_client_hash text
) returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_city text := btrim(coalesce(p_city, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_ref text;
  v_id uuid;
  v_recent integer;
  v_global integer;
begin
  if p_consent is not true then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  -- Same rules as the form and the server; the table constraints are a final backstop.
  if char_length(v_name) not between 2 and 120
     or char_length(v_city) not between 2 and 80
     or v_phone !~ '^\+?[0-9][0-9 ()-]{6,19}$'
     or p_family_members is null or p_family_members not between 1 and 20
     or (v_note is not null and char_length(v_note) > 500)
     or p_language is null or p_language not in ('fa', 'en')
     or p_client_hash is null or p_client_hash !~ '^[0-9a-f]{64}$'
     or v_name ~ '[[:cntrl:]]' or v_city ~ '[[:cntrl:]]'
     or (v_note is not null and v_note ~ E'[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]')
  then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  -- Serialize throttle checks so a parallel burst cannot slip past the limits.
  perform pg_advisory_xact_lock(hashtext('afa_submission_throttle'));
  delete from public.submission_throttle where created_at < now() - interval '2 hours';
  select count(*) into v_recent from public.submission_throttle
    where client_hash = p_client_hash and created_at > now() - interval '1 hour';
  select count(*) into v_global from public.submission_throttle
    where created_at > now() - interval '1 hour';
  if v_recent >= 5 or v_global >= 200 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.submission_throttle (client_hash) values (p_client_hash);

  loop
    -- Hex characters only, so a submission can never look like an AFA-TEST- demo reference.
    v_ref := 'AFA-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-'
                    || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    exit when not exists (select 1 from public.requests where reference_code = v_ref);
  end loop;
  insert into public.requests (reference_code, full_name, phone, city, family_members, note, consent_given, language, is_test_data)
  values (v_ref, v_name, v_phone, v_city, p_family_members, v_note, true, p_language, false)
  returning id into v_id;
  insert into public.audit_log (request_id, action, to_status, details)
  values (v_id, 'submitted', 'pending_review', 'Submitted via public form');
  return v_ref;
end $$;
revoke execute on function public.submit_request(text, text, text, integer, text, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_request(text, text, text, integer, text, boolean, text, text)
  to service_role;

-- Deprecated helper: keep it unreachable from the public key as well.
revoke execute on function public.admin_status_counts() from authenticated;
