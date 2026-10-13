\set ON_ERROR_STOP on
-- Supabase-like grants, with auth/storage schema stubs solely for local PostgreSQL validation.
grant usage on schema public,auth to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into committee_members values ('00000000-0000-0000-0000-000000000001','administrator');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin if (select count(*) from seasons)<>0 then raise exception 'Nonmember can read'; end if; begin insert into teams(name) values('Denied'); raise exception 'Nonmember can write'; exception when insufficient_privilege then null; end; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into teams(name) values('Home'),('Away');
insert into players(name,team_id) select name||' Player',id from teams;
insert into fixtures(season_id,competition,played_on,home_team_id,away_team_id) select s.id,'cup','2026-10-01',h.id,a.id from seasons s,teams h,teams a where h.name='Home' and a.name='Away';
insert into result_sheets(fixture_id,storage_path) select id,'test/original.png' from fixtures;
select save_result(f.id,s.id,(select jsonb_agg(jsonb_build_object('number',n,'kind','Singles','winner',case when n<=7 then 'home' else 'away' end,'players',(select jsonb_agg(jsonb_build_object('player_id',p.id,'side',case when t.name='Home' then 'home' else 'away' end,'double_ones',1,'highest_score',180,'highest_checkout',100)) from players p join teams t on t.id=p.team_id))) from generate_series(1,12) n),true) from fixtures f join result_sheets s on s.fixture_id=f.id;
do $$ begin if (select count(*) from games)<>12 or (select count(*) from game_players)<>24 or (select count(*) from results where status='approved')<>1 then raise exception 'Result transaction failed'; end if; if (select count(*) from audit_log where table_name='results')<2 then raise exception 'No audit history'; end if; delete from result_sheets; if not exists(select 1 from result_sheets) then raise exception 'Original deleted'; end if; begin perform save_result((select id from fixtures),null,'[]'::jsonb,true);raise exception 'Incomplete result accepted';exception when raise_exception then if SQLERRM='Incomplete result accepted' then raise; end if;end; end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select save_result(f.id,s.id,(select jsonb_agg(jsonb_build_object('number',n,'kind','Singles','winner','away','players',(select jsonb_agg(jsonb_build_object('player_id',p.id,'side',case when t.name='Home' then 'home' else 'away' end,'double_ones',0)) from players p join teams t on t.id=p.team_id))) from generate_series(1,12) n),true) from fixtures f join result_sheets s on s.fixture_id=f.id;
do $$ begin if (select count(*) from games where winner='away')<>12 then raise exception 'Correction failed'; end if; if (select count(*) from result_sheets)<>1 then raise exception 'Correction lost original'; end if; if (select count(*) from audit_log where table_name='games' and action='DELETE')<>12 then raise exception 'Correction history missing'; end if; begin update games set winner='home';raise exception 'Approved games changed directly';exception when raise_exception then if SQLERRM='Approved games changed directly' then raise;end if;end; end $$;
reset role;
