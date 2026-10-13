-- Local PostgreSQL stubs, not a replacement for Supabase integration tests.
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid,bucket_id text);
alter table storage.objects enable row level security;
