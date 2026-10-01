-- Run once in Supabase > SQL Editor. Safe to re-run.
-- While the allowed-emails table is EMPTY, shared trees work as before (link only).
-- Once you add an email, shared trees need Google sign-in with an allowed email.
begin;
create table if not exists public.familytree_allowed_emails (
 email text primary key check (email = lower(email))
);
alter table public.familytree_allowed_emails enable row level security;
revoke all on table public.familytree_allowed_emails from public, anon, authenticated;

create or replace function public.familytree_check_access()
returns void language plpgsql security definer set search_path = '' as $$
declare em text;
begin
 if not exists (select 1 from public.familytree_allowed_emails) then return; end if;
 em := lower(coalesce(auth.jwt()->>'email',''));
 if em = '' or coalesce(auth.jwt()->'app_metadata'->>'provider','') <> 'google'
 then raise exception 'GOOGLE_SIGNIN_REQUIRED'; end if;
 if not exists (select 1 from public.familytree_allowed_emails where email = em)
 then raise exception 'GOOGLE_NOT_APPROVED'; end if;
end; $$;
revoke all on function public.familytree_check_access() from public, anon, authenticated;

create or replace function public.familytree_create(p_id uuid, p_token uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 perform public.familytree_check_access();
 if p_id is null or p_token is null or p_payload is null
 or jsonb_typeof(p_payload->'people') is distinct from 'array'
 or jsonb_typeof(p_payload->'partners') is distinct from 'array'
 or jsonb_typeof(p_payload->'edges') is distinct from 'array'
 then raise exception 'Invalid family tree'; end if;
 insert into public.familytree_documents(id,token_hash,payload)
 values (p_id,pg_catalog.md5(p_token::text),p_payload);
 return jsonb_build_object('id',p_id,'version',1,'payload',p_payload);
end; $$;

create or replace function public.familytree_get(p_id uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 perform public.familytree_check_access();
 select jsonb_build_object('version',d.version,'payload',d.payload) into result
 from public.familytree_documents d
 where d.id=p_id and d.token_hash=pg_catalog.md5(p_token::text);
 if result is null then raise exception 'Tree not found or access denied'; end if;
 return result;
end; $$;

create or replace function public.familytree_save(p_id uuid, p_token uuid, p_version bigint, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 perform public.familytree_check_access();
 if p_payload is null or jsonb_typeof(p_payload->'people') is distinct from 'array'
 or jsonb_typeof(p_payload->'partners') is distinct from 'array'
 or jsonb_typeof(p_payload->'edges') is distinct from 'array'
 then raise exception 'Invalid family tree'; end if;
 update public.familytree_documents d
 set payload=p_payload,version=d.version+1,updated_at=now()
 where d.id=p_id and d.token_hash=pg_catalog.md5(p_token::text) and d.version=p_version
 returning jsonb_build_object('version',d.version,'payload',d.payload) into result;
 if result is null then raise exception 'Tree changed or access denied. Export your edits before reloading.' using errcode='40001'; end if;
 return result;
end; $$;
commit;
