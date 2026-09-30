-- Run once in the SQL Editor of a dedicated Supabase project.
-- No family data belongs in GitHub. Tables deny all direct client access.
begin;
create table public.familytree_documents (
 id uuid primary key,
 token_hash text not null,
 payload jsonb not null,
 version bigint not null default 1,
 updated_at timestamptz not null default now(),
 constraint familytree_document_size check (octet_length(payload::text) <= 5000000)
);
alter table public.familytree_documents enable row level security;
revoke all on table public.familytree_documents from public, anon, authenticated;

create function public.familytree_create(p_id uuid, p_token uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if p_id is null or p_token is null or p_payload is null
 or jsonb_typeof(p_payload->'people') is distinct from 'array'
 or jsonb_typeof(p_payload->'partners') is distinct from 'array'
 or jsonb_typeof(p_payload->'edges') is distinct from 'array'
 then raise exception 'Invalid family tree'; end if;
 insert into public.familytree_documents(id,token_hash,payload)
 values (p_id,pg_catalog.md5(p_token::text),p_payload);
 return jsonb_build_object('id',p_id,'version',1,'payload',p_payload);
end; $$;

create function public.familytree_get(p_id uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 select jsonb_build_object('version',d.version,'payload',d.payload) into result
 from public.familytree_documents d
 where d.id=p_id and d.token_hash=pg_catalog.md5(p_token::text);
 if result is null then raise exception 'Tree not found or access denied'; end if;
 return result;
end; $$;

create function public.familytree_save(p_id uuid, p_token uuid, p_version bigint, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
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
revoke all on function public.familytree_create(uuid,uuid,jsonb) from public;
revoke all on function public.familytree_get(uuid,uuid) from public;
revoke all on function public.familytree_save(uuid,uuid,bigint,jsonb) from public;
grant execute on function public.familytree_create(uuid,uuid,jsonb) to anon, authenticated;
grant execute on function public.familytree_get(uuid,uuid) to anon, authenticated;
grant execute on function public.familytree_save(uuid,uuid,bigint,jsonb) to anon, authenticated;
commit;
