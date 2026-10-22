-- Read-only. Run only in the private committee SQL Editor and keep output private.
-- Missing handwriting cannot be reconstructed; use these rows to prioritise originals.
select s.name as season, f.played_on, f.competition, h.name as home_team,
 a.name as away_team, r.id as result_id, r.status,
 r.sheet_id is not null as original_linked,
 coalesce(jsonb_array_length(r.summary->'pending_achievements'),0) as unresolved_players,
 case when r.summary is null then 'Detailed games: inspect original and recorded game statistics'
      else 'Compare original Double 1 column and margin notes with saved summary' end as review_action
from public.results r join public.fixtures f on f.id=r.fixture_id
join public.seasons s on s.id=f.season_id join public.teams h on h.id=f.home_team_id
join public.teams a on a.id=f.away_team_id
order by f.played_on, h.name;
-- Same spelling within a team is flagged only. Never merge players automatically.
select team_id, lower(trim(name)) as name_to_check, count(*) as possible_duplicates
from public.players group by team_id,lower(trim(name)) having count(*)>1;
