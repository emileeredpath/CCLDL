begin;
create table public.committee_members(user_id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('administrator','secretary')));
-- Only one account may have committee access. Public registration stays disabled.
create unique index single_committee_account on public.committee_members ((true));
create function public.is_committee() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from committee_members where user_id=auth.uid()) $$;
revoke all on function public.is_committee() from public;
grant execute on function public.is_committee() to authenticated;
create table public.seasons(id uuid primary key default gen_random_uuid(), name text unique not null, starts_on date not null, ends_on date not null check(ends_on>=starts_on));
create table public.teams(id uuid primary key default gen_random_uuid(), name text unique not null);
create table public.players(id uuid primary key default gen_random_uuid(), name text not null, team_id uuid references public.teams(id));
create table public.fixtures(id uuid primary key default gen_random_uuid(), season_id uuid not null references public.seasons(id), competition text not null check(competition in ('league','cup')), played_on date not null, home_team_id uuid not null references public.teams(id), away_team_id uuid not null references public.teams(id), check(home_team_id<>away_team_id));
create table public.result_sheets(id uuid primary key default gen_random_uuid(), fixture_id uuid not null references public.fixtures(id), storage_path text unique not null, uploaded_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now());
create table public.results(id uuid primary key default gen_random_uuid(), fixture_id uuid unique not null references public.fixtures(id), sheet_id uuid references public.result_sheets(id), status text not null default 'draft' check(status in ('draft','approved')), updated_by uuid not null default auth.uid() references auth.users(id), updated_at timestamptz not null default now());
create table public.games(id uuid primary key default gen_random_uuid(), result_id uuid not null references public.results(id) on delete cascade, number integer not null check(number between 1 and 12), kind text not null check(kind in ('Pairs','Trebles','Captains & vice','Singles')), winner text not null check(winner in ('home','away')), unique(result_id,number));
create table public.game_players(id uuid primary key default gen_random_uuid(), game_id uuid not null references public.games(id) on delete cascade, player_id uuid not null references public.players(id), side text not null check(side in ('home','away')), double_ones integer not null default 0 check(double_ones>=0), highest_score integer check(highest_score between 0 and 180), highest_checkout integer check(highest_checkout between 0 and 170), unique(game_id,player_id));
create table public.audit_log(id bigint generated always as identity primary key, table_name text not null, record_id uuid not null, actor uuid references auth.users(id), action text not null, old_data jsonb, new_data jsonb, created_at timestamptz not null default now());
create function public.audit_change() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into audit_log(table_name,record_id,actor,action,old_data,new_data) values(TG_TABLE_NAME,coalesce(new.id,old.id),auth.uid(),TG_OP,case when TG_OP<>'INSERT' then to_jsonb(old) end,case when TG_OP<>'DELETE' then to_jsonb(new) end); return coalesce(new,old); end $$;
do $$ declare t text; begin foreach t in array array['seasons','teams','players','fixtures','result_sheets','results','games','game_players'] loop execute format('alter table public.%I enable row level security',t); execute format('create policy committee_access on public.%I for all to authenticated using (public.is_committee()) with check (public.is_committee())',t); execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function public.audit_change()',t); end loop; end $$;
alter table public.committee_members enable row level security;
create policy own_membership on public.committee_members for select to authenticated using(user_id=auth.uid());
alter table public.audit_log enable row level security;
create policy committee_audit_read on public.audit_log for select to authenticated using(public.is_committee());
-- Keep originals: client roles cannot delete photographs or archive metadata.
create policy sheet_read on public.result_sheets as restrictive for delete to authenticated using(false);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('result-sheets','result-sheets',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy sheet_object_read on storage.objects for select to authenticated using(bucket_id='result-sheets' and public.is_committee());
create policy sheet_object_insert on storage.objects for insert to authenticated with check(bucket_id='result-sheets' and public.is_committee());
-- No object update/delete policies: edits retain original photographs.
create function public.save_result(p_fixture uuid,p_sheet uuid,p_games jsonb,p_approve boolean) returns uuid language plpgsql security invoker set search_path=public as $$
declare rid uuid; comp text; g jsonb; gp jsonb; gid uuid; pid uuid; expected text; n integer; count_players integer;
begin
 if not public.is_committee() then raise exception 'Committee access required'; end if;
 select competition into strict comp from fixtures where id=p_fixture;
 if p_sheet is not null and not exists(select 1 from result_sheets where id=p_sheet and fixture_id=p_fixture) then raise exception 'Sheet belongs to another fixture'; end if;
 if jsonb_array_length(p_games)<>12 then raise exception 'Exactly 12 games required'; end if;
 if (select count(distinct (x->>'number')::int) from jsonb_array_elements(p_games) x)<>12 then raise exception 'Game numbers must be unique'; end if;
 insert into results(fixture_id,sheet_id,status) values(p_fixture,p_sheet,'draft') on conflict(fixture_id) do update set sheet_id=coalesce(excluded.sheet_id,results.sheet_id),status='draft',updated_by=auth.uid(),updated_at=now() returning id into rid;
 delete from games where result_id=rid;
 for g in select * from jsonb_array_elements(p_games) loop
 n=(g->>'number')::int;
 expected=case when comp='cup' or n>=7 then 'Singles' when n<=3 then 'Pairs' when n<=5 then 'Trebles' else 'Captains & vice' end;
 if g->>'kind'<>expected then raise exception 'Wrong game format'; end if;
 count_players=case when expected='Trebles' then 3 when expected in ('Pairs','Captains & vice') then 2 else 1 end;
 if (select count(*) from jsonb_array_elements(g->'players') p where p->>'side'='home')<>count_players or (select count(*) from jsonb_array_elements(g->'players') p where p->>'side'='away')<>count_players then raise exception 'Enter every player for both sides'; end if;
 insert into games(result_id,number,kind,winner) values(rid,n,expected,g->>'winner') returning id into gid;
 for gp in select * from jsonb_array_elements(g->'players') loop
 pid=(gp->>'player_id')::uuid;
 if not exists(select 1 from players p join fixtures f on f.id=p_fixture where p.id=pid and p.team_id=case when gp->>'side'='home' then f.home_team_id else f.away_team_id end) then raise exception 'Player must belong to selected side'; end if;
 insert into game_players(game_id,player_id,side,double_ones,highest_score,highest_checkout) values(gid,pid,gp->>'side',coalesce((gp->>'double_ones')::int,0),(gp->>'highest_score')::int,(gp->>'highest_checkout')::int);
 end loop;
 end loop;
 update results set status=case when p_approve then 'approved' else 'draft' end where id=rid;
 return rid;
end $$;
revoke all on function public.save_result(uuid,uuid,jsonb,boolean) from public;
grant execute on function public.save_result(uuid,uuid,jsonb,boolean) to authenticated;
-- Approval is only possible through the validating transaction above.
create function public.validate_approval() returns trigger language plpgsql set search_path=public as $$
declare comp text; g record; expected text; pc integer;
begin
 if new.status='approved' then
  if new.sheet_id is null or not exists(select 1 from result_sheets where id=new.sheet_id and fixture_id=new.fixture_id) then raise exception 'Approval requires an archived sheet for this fixture'; end if;
  if (select count(*) from games where result_id=new.id)<>12 then raise exception 'Approval requires 12 complete games'; end if;
  select competition into strict comp from fixtures where id=new.fixture_id;
  for g in select * from games where result_id=new.id loop
   expected=case when comp='cup' or g.number>=7 then 'Singles' when g.number<=3 then 'Pairs' when g.number<=5 then 'Trebles' else 'Captains & vice' end;
   pc=case when expected='Trebles' then 3 when expected in ('Pairs','Captains & vice') then 2 else 1 end;
   if g.kind<>expected or (select count(*) from game_players where game_id=g.id and side='home')<>pc or (select count(*) from game_players where game_id=g.id and side='away')<>pc then raise exception 'Incorrect game format or missing players'; end if;
   if exists(select 1 from game_players gp join players p on p.id=gp.player_id join fixtures f on f.id=new.fixture_id where gp.game_id=g.id and p.team_id is distinct from case when gp.side='home' then f.home_team_id else f.away_team_id end) then raise exception 'Player belongs to another team'; end if;
  end loop;
 end if;
 return new;
end $$;
create function public.protect_approved_games() returns trigger language plpgsql set search_path=public as $$
declare rid uuid;
begin
 if TG_TABLE_NAME='games' then rid=coalesce(new.result_id,old.result_id);
 else select result_id into rid from games where id=coalesce(new.game_id,old.game_id); end if;
 if exists(select 1 from results where id=rid and status='approved') then raise exception 'Reopen as draft before editing approved games'; end if;
 return coalesce(new,old);
end $$;
create trigger protect_games before insert or update or delete on public.games for each row execute function public.protect_approved_games();
create trigger protect_game_players before insert or update or delete on public.game_players for each row execute function public.protect_approved_games();
create trigger approval_check before insert or update on public.results for each row execute function public.validate_approval();
insert into public.seasons(name,starts_on,ends_on) values('2026/27','2026-09-01','2027-08-31');
commit;
