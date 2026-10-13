begin;
-- Additive: detailed results and original photos are retained.
alter table public.results add column summary jsonb;
alter function public.validate_approval() rename to validate_detailed_approval;
-- Trigger functions cannot call one another. Keep the old trigger for detailed records.
drop trigger approval_check on public.results;
create trigger approval_check before insert or update on public.results for each row when (new.summary is null) execute function public.validate_detailed_approval();
create function public.validate_summary_approval() returns trigger language plpgsql set search_path=public as $$
declare comp text; k text; maximum integer; n numeric; p jsonb; f fixtures; seen uuid[] := '{}'; pid uuid;
begin
 if new.summary is null then return new; end if;
 select * into strict f from fixtures where id=new.fixture_id;
 comp=f.competition;
 if jsonb_typeof(new.summary->'counts') is distinct from 'object' or jsonb_typeof(new.summary->'achievements') is distinct from 'array' then raise exception 'Invalid result summary'; end if;
 if (select count(*) from jsonb_object_keys(new.summary->'counts')) <> (case when comp='cup' then 1 else 4 end) then raise exception 'Incorrect score categories'; end if;
 foreach k in array (case when comp='cup' then array['Singles'] else array['Pairs','Trebles','Captains & vice','Singles'] end) loop
 maximum=case when k='Pairs' then 3 when k='Trebles' then 2 when k='Captains & vice' then 1 when comp='cup' then 12 else 6 end;
 if jsonb_typeof(new.summary->'counts'->k) is distinct from 'number' then raise exception 'Score must be a number'; end if;
 n=(new.summary->'counts'->>k)::numeric;
 if n is null or n<>trunc(n) or n<0 or n>maximum then raise exception 'Invalid % total',k; end if;
 end loop;
 for p in select * from jsonb_array_elements(new.summary->'achievements') loop
 pid=(p->>'player_id')::uuid;
 if pid is null or pid=any(seen) then raise exception 'Choose each achievement player once'; end if;
 seen=array_append(seen,pid);
 if p->>'side' is null or p->>'side' not in ('home','away') or not exists(select 1 from players where id=pid and team_id=case when p->>'side'='home' then f.home_team_id else f.away_team_id end) then raise exception 'Player must belong to a match team'; end if;
 foreach k in array array['double_ones','highest_score','highest_checkout'] loop
 if p->>k is not null and jsonb_typeof(p->k) is distinct from 'number' then raise exception 'Statistic must be a number'; end if;
 n=(p->>k)::numeric;
 maximum=case k when 'double_ones' then 999 when 'highest_score' then 180 else 170 end;
 if (k='double_ones' and n is null) or (n is not null and (n<>trunc(n) or n<(case when k='double_ones' then 0 else 1 end) or n>maximum)) then raise exception 'Invalid player statistic'; end if;
 end loop;
 if coalesce((p->>'double_ones')::int,0)=0 and p->>'highest_score' is null and p->>'highest_checkout' is null then raise exception 'Enter at least one achievement'; end if;
 end loop;
 if new.status='approved' then
 if new.sheet_id is null or not exists(select 1 from result_sheets where id=new.sheet_id and fixture_id=new.fixture_id) then raise exception 'Approval requires an original sheet for this fixture'; end if;
 if exists(select 1 from games where result_id=new.id) then raise exception 'Summary and detailed games cannot be combined'; end if;
 end if;
 return new;
end $$;
create trigger summary_approval_check before insert or update on public.results for each row execute function public.validate_summary_approval();
create function public.save_summary_result(p_fixture uuid,p_sheet uuid,p_summary jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare rid uuid;
begin
 if not public.is_committee() then raise exception 'Committee access required'; end if;
 -- Serialize saves for a fixture. Refuse to replace detailed results silently.
 perform 1 from fixtures where id=p_fixture for update;
 if exists(select 1 from results r join games g on g.result_id=r.id where r.fixture_id=p_fixture) then raise exception 'This result has individual games. Edit it using the detailed form to preserve them.'; end if;
 insert into results(fixture_id,sheet_id,status,summary) values(p_fixture,p_sheet,'approved',p_summary)
 on conflict(fixture_id) do update set sheet_id=coalesce(excluded.sheet_id,results.sheet_id),summary=excluded.summary,status='approved',updated_by=auth.uid(),updated_at=now() returning id into rid;
 return rid;
end $$;
revoke all on function public.save_summary_result(uuid,uuid,jsonb) from public;
grant execute on function public.save_summary_result(uuid,uuid,jsonb) to authenticated;
commit;
