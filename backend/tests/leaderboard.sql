-- Disposable database only; tests rollback all player data.
begin;
set local role service_role;
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); run_a uuid:=gen_random_uuid();run_b uuid:=gen_random_uuid();j jsonb; rejected boolean; hits integer:=0;
begin
 perform public.family_leaderboard(a,repeat('a',64),'start',jsonb_build_object('token',run_a,'nickname','Frederik','difficulty','normal','mode','survival','rules','family-v2-1','offline',true));
 j:=public.family_leaderboard(a,repeat('a',64),'submit',jsonb_build_object('token',run_a,'nickname','Frederik','highest_wave',0,'zombies',5,'duration',10,'mode','survival','rules','family-v2-1'));
 assert (j->>'best_score')::int=50;
 perform public.family_leaderboard(b,repeat('a',64),'start',jsonb_build_object('token',run_b,'nickname','Kim','difficulty','normal','mode','survival','rules','family-v2-1','offline',true));
 j:=public.family_leaderboard(b,repeat('a',64),'submit',jsonb_build_object('token',run_b,'nickname','Kim','highest_wave',1,'zombies',9,'duration',20,'mode','survival','rules','family-v2-1'));
 assert (j->>'rank')::int=1 and (j->>'best_score')::int=190;
 j:=public.family_leaderboard(a,repeat('a',64),'list','{"difficulty":"normal"}');
 assert jsonb_array_length(j->'scores')=2;
 assert j->'scores'->0->>'nickname'='Kim';
 assert j->'scores'->1->>'nickname'='Frederik';
 assert not (j->'scores'->0 ? 'actor');
 -- Retry is idempotent, even if a caller attempts to replace finalized metrics.
 j:=public.family_leaderboard(a,repeat('a',64),'submit',jsonb_build_object('token',run_a,'nickname','Frederik','highest_wave',99,'zombies',999999,'duration',10,'mode','survival','rules','family-v2-1'));
 assert (j->>'best_score')::int=50 and (j->>'rank')::int=2;
 rejected:=false;
 begin perform public.family_leaderboard(a,repeat('a',64),'submit',jsonb_build_object('token',run_b,'nickname','Frederik'));exception when others then rejected:=true;end;
 assert rejected,'Cannot submit another player’s run';
 rejected:=false;
 begin perform public.family_leaderboard(a,repeat('a',64),'start',jsonb_build_object('token',gen_random_uuid(),'nickname','Frederik','difficulty','normal','mode','creative','rules','family-v2-1'));exception when others then rejected:=true;end;
 assert rejected,'Creative excluded';
 rejected:=false;
 begin perform public.family_leaderboard(a,repeat('a',64),'submit',jsonb_build_object('token',run_a,'nickname','Frederik','score',999999));exception when others then rejected:=true;end;
 assert rejected,'No arbitrary score field';
 rejected:=false;
 begin perform public.family_leaderboard(a,repeat('a',64),'list','{"difficulty":"normal","offset":-1}');exception when others then rejected:=true;end;
 assert rejected,'Pagination bounds';
 -- Invalid, unfinalized statistics cannot become scores.
 rejected:=false;
 begin
  perform public.family_leaderboard(a,repeat('a',64),'start',jsonb_build_object('token',gen_random_uuid(),'nickname','Bad@email','difficulty','normal','mode','survival','rules','family-v2-1'));
 exception when others then rejected:=true;end;
 assert rejected,'No email-like nickname';
 for i in 1..12 loop
  declare player uuid:=gen_random_uuid(); token uuid:=gen_random_uuid();
  begin
   perform public.family_leaderboard(player,repeat('b',64),'start',jsonb_build_object('token',token,'nickname','Knight '||i,'difficulty','normal','mode','survival','rules','family-v2-1','offline',true));
   rejected:=false;
   begin perform public.family_leaderboard(player,repeat('b',64),'submit',jsonb_build_object('token',token,'nickname','Knight '||i,'highest_wave',1,'zombies',0,'duration',20,'mode','survival','rules','family-v2-1'));exception when others then rejected:=true;end;
   assert rejected,'A completed wave requires its zombies to be defeated';
   perform public.family_leaderboard(player,repeat('b',64),'submit',jsonb_build_object('token',token,'nickname','Knight '||i,'highest_wave',0,'zombies',1,'duration',10,'mode','survival','rules','family-v2-1'));
  end;
 end loop;
 j:=public.family_leaderboard(b,repeat('a',64),'list','{"difficulty":"normal"}');assert jsonb_array_length(j->'scores')=10 and (j->>'more')::boolean;
 j:=public.family_leaderboard(b,repeat('a',64),'list','{"difficulty":"normal","offset":10}');assert jsonb_array_length(j->'scores')=4;
 j:=public.family_leaderboard(b,repeat('a',64),'list','{"difficulty":"hard"}');assert jsonb_array_length(j->'scores')=0;
 for i in 1..150 loop
  begin perform public.family_leaderboard(a,repeat('a',64),'list','{"difficulty":"normal"}');exception when others then hits:=hits+1;end;
 end loop;
 assert hits>0,'Rate limit must reject excess requests';
end $$;
reset role;
set local role anon;
do $$
declare rejected boolean:=false;
begin
 begin perform public.family_leaderboard(gen_random_uuid(),repeat('a',64),'list','{"difficulty":"normal"}');exception when insufficient_privilege then rejected:=true;end;
 assert rejected,'Browser roles cannot invoke service RPC directly';
 rejected:=false;
 begin perform 1 from leaderboard_private.scores;exception when insufficient_privilege then rejected:=true;end;
 assert rejected,'Browser roles cannot access private tables';
end $$;
rollback;
