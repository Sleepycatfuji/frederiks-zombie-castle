"""Run SQL integration checks in an already-running disposable postgres container."""
from pathlib import Path
import os,subprocess,sys
root=Path(__file__).resolve().parents[2]
env=os.environ.copy()
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
command=['docker','--host=unix:///var/run/docker.sock','exec','-i',sys.argv[1] if len(sys.argv)>1 else 'zcd-leaderboard-test','psql','-U','postgres','-v','ON_ERROR_STOP=1']
def run(sql):
 p=subprocess.run(command,input=sql,text=True,capture_output=True,env=env)
 if p.returncode:print(p.stdout,p.stderr);raise SystemExit(p.returncode)
run("do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;end $$;")
run("drop schema if exists leaderboard_private cascade;drop function if exists public.family_leaderboard(uuid,text,text,jsonb);")
run((root/'supabase/migrations/202611120001_family_leaderboard.sql').read_text())
run((root/'backend/tests/leaderboard.sql').read_text())
print('PASS PostgreSQL: two independent identities, shared rankings, server scoring, idempotency, ownership, creative exclusion, rate limits and private-table permissions')
