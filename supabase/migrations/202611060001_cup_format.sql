-- Cup Double 1s count towards the Pitt Stop Madhouse Trophy only when the Cup
-- is played as a round robin (every team plays the same number of Cup games).
-- In a knockout season only League Double 1s count.
alter table public.seasons
  add column if not exists cup_format text not null default 'round_robin'
  check (cup_format in ('round_robin', 'knockout'));
