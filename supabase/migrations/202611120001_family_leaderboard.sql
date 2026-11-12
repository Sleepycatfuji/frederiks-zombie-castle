-- Run once in a Supabase project. Browser roles cannot access these tables or this RPC.
begin;
create schema if not exists leaderboard_private;
revoke all on schema leaderboard_private from public, anon, authenticated;
create table leaderboard_private.players(actor uuid primary key,nickname text not null check(char_length(nickname) between 1 and 20));
create table leaderboard_private.runs(token uuid primary key,actor uuid not null references leaderboard_private.players(actor),difficulty text not null check(difficulty in ('easy','normal','hard')),started_at timestamptz not null default now(),offline boolean not null,finalized boolean not null default false);
create table leaderboard_private.scores(run uuid primary key references leaderboard_private.runs(token),actor uuid not null references leaderboard_private.players(actor),difficulty text not null,highest_wave integer not null,zombies integer not null,score bigint not null,achieved_at timestamptz not null default now(),offline boolean not null);
create index on leaderboard_private.scores(difficulty,score desc,achieved_at);
create table leaderboard_private.request_limits(key text not null,bucket_at timestamptz not null,requests integer not null,primary key(key,bucket_at));
create index on leaderboard_private.request_limits(bucket_at);
alter table leaderboard_private.players enable row level security;
alter table leaderboard_private.runs enable row level security;
alter table leaderboard_private.scores enable row level security;
alter table leaderboard_private.request_limits enable row level security;
revoke all on all tables in schema leaderboard_private from public,anon,authenticated;
create or replace function public.family_leaderboard(p_actor uuid,p_ip text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
  minute timestamptz:=date_trunc('minute',clock_timestamp());
  bucket text; quota integer; used integer; nickname text; difficulty text;
  run leaderboard_private.runs%rowtype; highest integer; zombies integer; duration double precision;
  rank_value bigint; best_score bigint; results jsonb; page_offset integer;
begin
  if p_actor is null or p_ip is null or length(p_ip)<>64 or p_action not in ('start','submit','list') then raise exception 'Invalid request'; end if;
  foreach bucket in array array['actor:'||p_actor::text,'ip:'||p_ip] loop
    perform pg_advisory_xact_lock(hashtextextended(bucket,0));
    quota:=case when p_action='list' then 120 else 20 end;
    if bucket like 'ip:%' then quota:=quota*3;end if;
    insert into leaderboard_private.request_limits values(bucket,minute,1)
      on conflict(key,bucket_at) do update set requests=leaderboard_private.request_limits.requests+1 returning requests into used;
    if used>quota then raise exception 'Rate limit exceeded';end if;
  end loop;
  delete from leaderboard_private.request_limits where bucket_at<now()-interval '2 days';
  if p_action in ('start','submit') then
    nickname:=trim(p_data->>'nickname');
    if nickname is null or nickname !~ '^[[:alnum:] _-]{1,20}$' then raise exception 'Use a nickname of 1-20 letters, numbers, spaces, underscores or hyphens';end if;
    insert into leaderboard_private.players values(p_actor,nickname) on conflict(actor) do update set nickname=excluded.nickname;
  end if;
  if p_action='start' then
    if p_data->>'mode' is distinct from 'survival' or p_data->>'rules' is distinct from 'family-v2-1' then raise exception 'Only current Survival runs qualify';end if;
    difficulty:=p_data->>'difficulty';
    if difficulty is null or difficulty not in ('easy','normal','hard') then raise exception 'Invalid difficulty';end if;
    insert into leaderboard_private.runs(token,actor,difficulty,offline) values((p_data->>'token')::uuid,p_actor,difficulty,coalesce((p_data->>'offline')::boolean,false)) on conflict(token) do nothing;
    select * into run from leaderboard_private.runs where token=(p_data->>'token')::uuid for update;
    if run.actor<>p_actor or run.difficulty<>difficulty then raise exception 'Run belongs to another player or difficulty';end if;
    return jsonb_build_object('registered',true);
  elsif p_action='submit' then
    if p_data ? 'score' then raise exception 'Scores are calculated on the server';end if;
    select * into run from leaderboard_private.runs where token=(p_data->>'token')::uuid for update;
    if not found or run.actor<>p_actor then raise exception 'Unknown run';end if;
    if not run.finalized then
      if p_data->>'rules' is distinct from 'family-v2-1' or p_data->>'mode' is distinct from 'survival' then raise exception 'Only current Survival runs qualify';end if;
      highest:=(p_data->>'highest_wave')::integer;zombies:=(p_data->>'zombies')::integer;duration:=(p_data->>'duration')::double precision;
      if highest is null or zombies is null or duration is null or highest<0 or highest>1000 or zombies<0
        or zombies<(6*highest+3*highest*(highest+1)/2)
        or zombies>(6*(highest+1)+3*(highest+1)*(highest+2)/2)
        or duration<greatest(0,highest*2) or duration>604800 or duration='NaN'::double precision then raise exception 'Implausible run statistics';end if;
      if not run.offline and duration>extract(epoch from now()-run.started_at)*2+30 then raise exception 'Run duration exceeds server time';end if;
      insert into leaderboard_private.scores(run,actor,difficulty,highest_wave,zombies,score,offline)
        values(run.token,p_actor,run.difficulty,highest,zombies,highest::bigint*100+zombies::bigint*10,run.offline);
      update leaderboard_private.runs set finalized=true where token=run.token;
    end if;
    difficulty:=run.difficulty;
    select max(s.score) into best_score from leaderboard_private.scores s where s.actor=p_actor and s.difficulty=run.difficulty;
    select 1+count(*) into rank_value from (select s.actor,max(s.score) as score from leaderboard_private.scores s where s.difficulty=run.difficulty group by s.actor) b where b.score>best_score;
    return jsonb_build_object('rank',rank_value,'best_score',best_score,'difficulty',difficulty);
  end if;
  difficulty:=p_data->>'difficulty';
  if difficulty is null or difficulty not in ('easy','normal','hard') then raise exception 'Invalid difficulty';end if;
  page_offset:=coalesce((p_data->>'offset')::integer,0);
  if page_offset<0 or page_offset>10000 then raise exception 'Invalid page';end if;
  with best as (
    select distinct on(s.actor) s.* from leaderboard_private.scores s where s.difficulty=difficulty order by s.actor,s.score desc,s.achieved_at asc
  ), ranked as (
    select b.*,rank() over(order by b.score desc) as ranking from best b
  ), page as (
    select r.ranking,p.nickname,r.highest_wave,r.zombies,r.score,r.difficulty,r.achieved_at,r.offline
    from ranked r join leaderboard_private.players p on p.actor=r.actor order by r.score desc,r.achieved_at,r.actor limit 10 offset page_offset
  ) select coalesce(jsonb_agg(to_jsonb(page)),'[]') into results from page;
  return jsonb_build_object('scores',results,'offset',page_offset,'more',jsonb_array_length(results)=10);
end $$;
revoke all on function public.family_leaderboard(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.family_leaderboard(uuid,text,text,jsonb) to service_role;

commit;
