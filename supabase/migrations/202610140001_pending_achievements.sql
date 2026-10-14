begin;
-- Keep transcribed but unidentified achievements in drafts until attributed.
-- Safe to apply again; no tables or records are removed.
create or replace function public.check_pending_achievements() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.summary ? 'pending_achievements' then
  if jsonb_typeof(new.summary->'pending_achievements') is distinct from 'array' then
   raise exception 'Pending achievements must be a list';
  end if;
  if new.status='approved' and jsonb_array_length(new.summary->'pending_achievements')>0 then
   raise exception 'Confirm the pending achievement players before approval';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists pending_achievement_check on public.results;
create trigger pending_achievement_check before insert or update on public.results
for each row execute function public.check_pending_achievements();
create or replace function public.save_summary_draft(p_fixture uuid,p_sheet uuid,p_summary jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare rid uuid;
begin
 if not public.is_committee() then raise exception 'Committee access required'; end if;
 perform 1 from fixtures where id=p_fixture for update;
 if exists(select 1 from results where fixture_id=p_fixture and status='approved') then
  raise exception 'This match is already approved. Use review and save to correct it.';
 end if;
 if exists(select 1 from results r join games g on g.result_id=r.id where r.fixture_id=p_fixture) then
  raise exception 'Keep this result in its detailed game editor';
 end if;
 if p_summary is null then raise exception 'Enter the score summary'; end if;
 if p_sheet is not null and not exists(select 1 from result_sheets where id=p_sheet and fixture_id=p_fixture) then
  raise exception 'Sheet belongs to another fixture';
 end if;
 insert into results(fixture_id,sheet_id,status,summary) values(p_fixture,p_sheet,'draft',p_summary)
 on conflict(fixture_id) do update set sheet_id=coalesce(excluded.sheet_id,results.sheet_id),summary=excluded.summary,updated_by=auth.uid(),updated_at=now()
 returning id into rid;
 return rid;
end $$;
revoke all on function public.save_summary_draft(uuid,uuid,jsonb) from public;
grant execute on function public.save_summary_draft(uuid,uuid,jsonb) to authenticated;
commit;
