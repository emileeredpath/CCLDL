begin;
-- Hide duplicate uploads while retaining original files and the audit trail.
alter table public.result_sheets add column if not exists removed_at timestamptz;
create or replace function public.remove_result_sheet(p_sheet uuid) returns void
language plpgsql security invoker set search_path=public as $$
begin
 if not public.is_committee() then raise exception 'Committee access required'; end if;
 perform 1 from result_sheets where id=p_sheet for update;
 if not found then raise exception 'Photograph not found'; end if;
 if exists(select 1 from results where sheet_id=p_sheet) then
  raise exception 'This is the original linked to the saved result. Keep this photo and remove the extra uploads instead.';
 end if;
 update result_sheets set removed_at=now() where id=p_sheet and removed_at is null;
end $$;
revoke all on function public.remove_result_sheet(uuid) from public;
grant execute on function public.remove_result_sheet(uuid) to authenticated;
-- Also protect against a concurrent approval linking a removed image.
create or replace function public.require_active_result_sheet() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.sheet_id is not null then
  perform 1 from result_sheets where id=new.sheet_id and removed_at is null for share;
  if not found then raise exception 'Choose an active original photograph for this result'; end if;
 end if;
 return new;
end $$;
drop trigger if exists active_result_sheet on public.results;
create trigger active_result_sheet before insert or update on public.results
for each row execute function public.require_active_result_sheet();
commit;
