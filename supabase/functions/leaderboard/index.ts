// Privileged credentials stay in Supabase Edge secrets, never in game assets.
const url=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const salt=Deno.env.get('LEADERBOARD_IP_SALT')!;
const allowed=(Deno.env.get('LEADERBOARD_ALLOWED_ORIGINS')||'http://localhost:8001').split(',').map(v=>v.trim()).filter(Boolean);
Deno.serve(async(request:Request)=>{
  const origin=request.headers.get('Origin')||'';
  const headers={'Content-Type':'application/json','Vary':'Origin','Access-Control-Allow-Origin':allowed.includes(origin)?origin:allowed[0],'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
  const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!allowed.includes(origin))return reply(403,{error:'Origin is not allowed.'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{error:'Use POST.'});
  if(!url||!service||!salt)return reply(503,{error:'Leaderboard is not configured.'});
  try{
    const raw=await request.text();if(raw.length>4096)return reply(413,{error:'Request too large.'});
    const token=request.headers.get('Authorization')||'';
    if(!/^Bearer .+/.test(token))return reply(401,{error:'Anonymous sign-in required.'});
    const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:service,Authorization:token},signal:AbortSignal.timeout(10000)});
    if(!auth.ok)return reply(401,{error:'Your anonymous session expired.'});
    const player=await auth.json();if(!player.id)return reply(401,{error:'Anonymous sign-in required.'});
    const body=JSON.parse(raw);if(!['start','submit','list'].includes(body.action))return reply(400,{error:'Unknown action.'});
    // Supabase's gateway supplies these headers. Only salted hashes reach the database.
    const ip=request.headers.get('cf-connecting-ip')||(request.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+ip));
    const hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
    const response=await fetch(url+'/rest/v1/rpc/family_leaderboard',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({p_actor:player.id,p_ip:hash,p_action:body.action,p_data:body.data||{}}),signal:AbortSignal.timeout(10000)});
    const data=await response.json();
    if(!response.ok){const message=String(data.message||'Invalid score request.');return reply(message.includes('Rate limit')?429:400,{error:message.includes('Rate limit')?'Too many requests. Try again in a minute.':message});}
    return reply(200,data);
  }catch{return reply(503,{error:'Leaderboard unavailable. Your queued scores stay on this device.'});}
});
