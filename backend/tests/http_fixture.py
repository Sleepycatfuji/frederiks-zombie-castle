"""Loopback-only test gateway backed by real disposable PostgreSQL.
It emulates anonymous Auth for browser tests; production uses Supabase Auth + Edge.
"""
import hashlib,http.server,json,os,secrets,subprocess,uuid,functools
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class Gateway(http.server.SimpleHTTPRequestHandler):
 sessions={}
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)
 def log_message(self,*args):pass
 def reply(self,status,data):
  raw=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
 def do_GET(self):
  if self.path=='/js/online-config.js':
   raw=('window.ZCD_LEADERBOARD='+json.dumps({'url':f'http://127.0.0.1:{self.server.server_port}','publicKey':'public-fixture-key'})+';').encode();self.send_response(200);self.send_header('Content-Type','text/javascript');self.end_headers();self.wfile.write(raw);return
  super().do_GET()
 def do_POST(self):
  if int(self.headers.get('Content-Length','0'))>4096:self.reply(413,{'error':'Too large'});return
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
  if self.path=='/auth/v1/signup':
   token=secrets.token_urlsafe(32);actor=str(uuid.uuid4());self.sessions[token]=actor;self.reply(200,{'access_token':token,'refresh_token':'fixture-only','expires_in':3600,'user':{'id':actor}});return
  actor=self.sessions.get(self.headers.get('Authorization','').removeprefix('Bearer '))
  if not actor:self.reply(401,{'error':'Sign in'});return
  def q(value):return "'"+str(value).replace("'","''")+"'"
  sql='set role service_role;select public.family_leaderboard('+','.join([q(actor)+'::uuid',q(hashlib.sha256(b'fixture:127.0.0.1').hexdigest()),q(body['action']),q(json.dumps(body['data']))+'::jsonb'])+');'
  env=os.environ.copy()
  for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
  result=subprocess.run(['docker','--host=unix:///var/run/docker.sock','exec','-i',os.environ.get('LEADERBOARD_TEST_CONTAINER','zcd-leaderboard-test'),'psql','-U','postgres','-Atq','-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True,env=env)
  if result.returncode:self.reply(400,{'error':result.stderr.splitlines()[0]});return
  self.reply(200,json.loads(result.stdout.strip()))
def serve():return http.server.ThreadingHTTPServer(('127.0.0.1',0),Gateway)
