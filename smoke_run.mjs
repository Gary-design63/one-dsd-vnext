process.env.DATABASE_URL="postgresql://dsdadmin:OneDsdProd2026x@onedsddbprod.postgres.database.azure.com:5432/onedsd?sslmode=require";
process.env.SESSION_SECRET="smoke_test_secret_0123456789abcdef0123456789";
process.env.PORT="8090"; process.env.NODE_ENV="production"; process.env.COOKIE_SECURE="false";
const base="http://localhost:8090";
const { createApp } = await import("./dist/server.js");
const server = createApp();
await new Promise(r=>server.listen(8090, r));
const out=[];
function log(...a){ out.push(a.join(" ")); }
// login
const lr = await fetch(base+"/sign-in",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"identifier=owner&password="+encodeURIComponent("OneDSD!Start2026"),redirect:"manual"});
const setc = lr.headers.getSetCookie ? lr.headers.getSetCookie() : [lr.headers.get("set-cookie")];
const cookie = (setc||[]).map(c=>String(c).split(";")[0]).join("; ");
log("LOGIN status="+lr.status+" cookie="+(cookie?"yes":"NO"));
const H={headers:{Cookie:cookie}};
const routes=["/","/library","/learning","/calendar","/audio","/surveys","/growth","/ask","/console","/console/consultations","/console/controls","/console/history","/library/75a3b9d3-f552-4c4a-ae41-cb61857693cf","/learning/d10d48db-e294-4bf4-9713-489442c82d1d"];
for(const r of routes){
  try{
    const resp=await fetch(base+r,{...H,redirect:"manual"});
    const t = (resp.status>=200&&resp.status<400)? await resp.text().catch(()=>"") : await resp.text().catch(()=>"");
    const bad = t.includes('"error"') || t.includes("internal_error") || resp.status>=500;
    log(`${bad?"FAIL":"ok "} ${resp.status} ${r}${bad?" <<"+t.slice(0,80):""}`);
  }catch(e){ log("ERR  "+r+" "+e.message); }
}
// agentic ask
try{
  const a=await fetch(base+"/api/ask",{method:"POST",headers:{Cookie:cookie,"Content-Type":"application/json"},body:JSON.stringify({question:"What does Olmstead require for community integration?"})});
  const j=await a.json().catch(()=>({}));
  log("ASK status="+a.status+" disposition="+(j.disposition||j.status||"?")+" citations="+((j.citations||[]).length)+" answerLen="+((j.answer||"").length));
}catch(e){ log("ASK ERR "+e.message); }
console.log(out.join("\n"));
server.close(); process.exit(0);
