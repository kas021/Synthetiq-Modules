'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load(realTimeout=false) {
  const code = fs.readFileSync(path.join(__dirname, '../sources/xstream-v1/index.js'), 'utf8');
  const anchor = '  globalThis.searchResults = searchResults;';
  assert.ok(code.includes(anchor));
  const c = vm.createContext({console:{log(){}},setTimeout,clearTimeout});
  vm.runInContext(code.replace(anchor, `globalThis.qa = {
    resolveProviderWithRetries, recordProviderHealth, providerIsQuarantined,
    externalRequest, videasyGetSeed, collectStreams,
    scoreLookmovieRow, findLookmovieHit, pickLookmovieEpisodeId,
    setLookmovie: f => lookmovieRequest = f,
    setRaw: f => rawRequest = f,
    setExternal: f => externalRequest = f,
    setClock: f => Date.now = f,
    setProviders: f => resolveProviderWithRetries = f,
    fast: realTimeout => { sleep = async () => {}; if (!realTimeout) settleWithin = p => p;
      softProbeStreams = async a => a.map(s => Object.assign({},s,{segmentProbeOk:true}));
      preferReliableStreams = a => a; orderHdFirst = a => a; }
  };\n` + anchor), c);
  c.qa.fast(realTimeout); return c.qa;
}
const parsed = {type:'tv',id:'5920',season:1,episode:1};
const deferred = () => { let resolve; const promise = new Promise(r=>resolve=r); return {promise,resolve}; };
const job = (resolve,name='probe') => ({name,resolve,timeout:1000,empty:[]});
function quarantine(q,name='probe') { for(let i=0;i<3;i++)q.recordProviderHealth(name,false); assert.equal(q.providerIsQuarantined(name),true); }
test('explicit fresh reaches the first provider attempt',async()=>{
  const q=load(),seen=[];
  await q.resolveProviderWithRetries(job(async(_p,o)=>{seen.push(o);return [{url:'https://media.test/one'}];}),parsed,true);
  assert.equal(seen.length,1); assert.equal(seen[0].fresh,true);
});
test('ordinary provider attempts keep the existing cached-first policy',async()=>{
  const q=load(),seen=[];
  await q.resolveProviderWithRetries(job(async(_p,o)=>{seen.push(o);return [];}),parsed,false);
  assert.equal(seen.length,2); assert.equal(seen[0].fresh,false);assert.equal(seen[1].fresh,true);
});
test('quarantine blocks ordinary attempts but allows one successful explicit probe',async()=>{
  const q=load();quarantine(q);let calls=0;
  const j=job(async()=>{calls++;return [{url:'https://media.test/one'}];});
  assert.equal((await q.resolveProviderWithRetries(j,parsed,false)).length,0);assert.equal(calls,0);
  assert.equal((await q.resolveProviderWithRetries(j,parsed,true)).length,1);assert.equal(calls,1);
  assert.equal(q.providerIsQuarantined('probe'),false);
});
test('failed half-open probe stays quarantined and does not run a second attempt',async()=>{
  const q=load();quarantine(q);let calls=0;
  await q.resolveProviderWithRetries(job(async()=>{calls++;return [];}),parsed,true);
  assert.equal(calls,1);assert.equal(q.providerIsQuarantined('probe'),true);
});
test('concurrent half-open callers never receive another title stream',async()=>{
  const q=load();quarantine(q);const d=deferred();let calls=0;
  const j=job(async p=>{calls++;await d.promise;return [{url:'https://media.test/'+p.id}];});
  const first=q.resolveProviderWithRetries(j,parsed,true);
  assert.equal((await q.resolveProviderWithRetries(j,{...parsed,id:'999'},true)).length,0);
  d.resolve();assert.equal((await first)[0].url,'https://media.test/5920');assert.equal(calls,1);
});
test('timed-out half-open keeps its lease until underlying IO actually settles',async()=>{
  const q=load(true);let now=Date.UTC(2026,9,6);q.setClock(()=>now);quarantine(q);const d=deferred();let calls=0;
  const j={...job(async()=>{calls++;return d.promise;}),timeout:20};
  assert.equal((await q.resolveProviderWithRetries(j,parsed,true)).length,0);
  assert.equal((await q.resolveProviderWithRetries(j,{...parsed,id:'999'},true)).length,0);assert.equal(calls,1);
  now+=120000;assert.equal((await q.resolveProviderWithRetries(j,parsed,true)).length,0);assert.equal(calls,1);
  d.resolve([]);await new Promise(r=>setImmediate(r));
  await q.resolveProviderWithRetries(job(async()=>{calls++;return [{url:'https://media.test/recovered'}];}),parsed,true);assert.equal(calls,2);
});
test('late concurrent short Retry-After cannot reduce an existing long cooldown',async()=>{
 const q=load(),a=deferred(),b=deferred();let calls=0;
 q.setRaw(()=>++calls===1?a.promise:b.promise);
 const first=q.externalRequest('https://media.test/a'),second=q.externalRequest('https://media.test/b');
 a.resolve({status:429,headers:{'retry-after':'180'}});await first;
 b.resolve({status:429,headers:{'retry-after':'1'}});await second;
 const blocked=await q.externalRequest('https://media.test/c');
 assert.ok(Number(blocked.headers['retry-after'])>170);assert.equal(calls,2);
});
for(const dateHeader of [false,true])test('429 host cooldown survives explicit fresh: '+dateHeader,async()=>{
  const q=load();let now=Date.UTC(2026,9,6),calls=0;q.setClock(()=>now);
  q.setRaw(async()=>++calls===1?{status:429,body:'',headers:{'Retry-After':dateHeader?new Date(now+30000).toUTCString():'30'}}:{status:200,body:'ok'});
  assert.equal((await q.externalRequest('https://media.test/a')).status,429);
  assert.equal((await q.externalRequest('https://media.test/b',{fresh:true})).status,429);assert.equal(calls,1);
  now+=30001;assert.equal((await q.externalRequest('https://media.test/b',{fresh:true})).status,200);assert.equal(calls,2);
});
test('one 502 per seed attempt instead of nested three-request fanout',async()=>{
  const q=load();let calls=0;q.setExternal(async()=>{calls++;return {status:502,body:'bad gateway'};});
  assert.equal(await q.videasyGetSeed('1',{}),'');assert.equal(calls,1);
});
for(const status of [429,503])for(const headerKind of ['fetch','uppercase'])test('transport headers preserve long Retry-After '+status+' '+headerKind,async()=>{
  const q=load();let now=Date.UTC(2026,9,6),calls=0;q.setClock(()=>now);
  const headers=headerKind==='fetch'?{get:key=>key==='retry-after'?'180':null}:{'RETRY-AFTER':'180'};
  q.setRaw(async()=>{calls++;return {status,headers,body:''};});
  await q.externalRequest('https://MEDIA.test/a');now+=61000;
  assert.equal((await q.externalRequest('https://media.test/b',{fresh:true})).status,429);assert.equal(calls,1);
  now+=120000;await q.externalRequest('https://media.test/b');assert.equal(calls,2);
});
test('outer retries are bounded to two 502 requests, not six',async()=>{
  const q=load();let calls=0;q.setExternal(async()=>{calls++;return {status:502,body:'bad gateway'};});
  await q.resolveProviderWithRetries(job(async(_p,o)=>{await q.videasyGetSeed('1',o);return [];}),parsed,true);
  assert.equal(calls,2);
});
test('old seed response cannot poison cache after fresh replacement',async()=>{
  const q=load(),d=deferred();let calls=0;
  q.setExternal(async()=>++calls===1?d.promise:{status:200,body:JSON.stringify({seed:'new-'+calls,ttlMs:30000})});
  const old=q.videasyGetSeed('1',{});
  assert.equal(await q.videasyGetSeed('1',{fresh:true}),'new-2');
  d.resolve({status:200,body:JSON.stringify({seed:'old',ttlMs:30000})});await old;
  assert.equal(await q.videasyGetSeed('1',{}),'new-3');assert.equal(calls,3);
  assert.equal(await q.videasyGetSeed('1',{}),'new-3');assert.equal(calls,3);
});
test('normal stream cache is unchanged and fresh reaches each provider',async()=>{
  const q=load();let calls=0;const fresh=[];
  q.setProviders(async(j,_p,f)=>{fresh.push(f);return j.name==='videasy'?{streams:[{url:'https://media.test/'+ ++calls,label:'720p'}]}:j.empty;});
  const first=await q.collectStreams(parsed,'sub');
  assert.equal(await q.collectStreams(parsed,'sub'),first);assert.equal(calls,1);
  fresh.length=0;assert.notEqual(await q.collectStreams(parsed,'sub',true),first);
  assert.equal(calls,2);assert.ok(fresh.length>0&&fresh.every(x=>x===true));
});
test('first verified provider returns without waiting and late routes cannot mutate the pack',async()=>{
 const q=load(),slow=deferred();
 q.setProviders(async j=>j.name==='lookmovie'?[{url:'https://media.test/fast',segmentProbeOk:true}]:j.name==='videasy'?slow.promise:j.empty);
 const pack=await Promise.race([q.collectStreams(parsed,'sub'),new Promise((_,reject)=>setTimeout(()=>reject(Error('waited for slow provider')),100))]);
 const snapshot=JSON.stringify(pack);
 assert.ok(snapshot.includes('https://media.test/fast'));
 slow.resolve({streams:[{url:'https://media.test/late',segmentProbeOk:true}]});
 await new Promise(r=>setImmediate(r));
 assert.equal(JSON.stringify(pack),snapshot);
});
test('failed-probe result does not trigger early return before verified provider',async()=>{
 const q=load(),slow=deferred();let settled=false;
 q.setProviders(async j=>j.name==='lookmovie'?slow.promise:j.name==='videasy'?{streams:[{url:'https://media.test/bad',segmentProbeOk:false}]}:j.empty);
 const pending=q.collectStreams(parsed,'sub').then(p=>{settled=true;return p;});
 await new Promise(r=>setImmediate(r));assert.equal(settled,false);
 slow.resolve([{url:'https://media.test/good',segmentProbeOk:true}]);
 assert.ok(JSON.stringify(await pending).includes('https://media.test/good'));
});
test('LookMovie rejects year-only, prefix-only and conflicting identities',()=>{
 const q=load();
 for(const row of [{title:'Unrelated Film',year:2021},{title:'Dune: Another Story',year:2021},{title:'Dune',year:1984},{title:'Dune',year:2021,slug:'1234567-other'}])
  assert.equal(q.scoreLookmovieRow('Dune',2021,'1160419',row),-1);
 assert.equal(q.scoreLookmovieRow('Dune',2021,'1160419',{title:'Localized title',year:2022,slug:'1160419-dune'}),5000);
 assert.equal(q.scoreLookmovieRow('Dune',2021,'',{title:'Dune',year:2021,slug:'dune'}),1350);
 assert.equal(q.scoreLookmovieRow('Dune',null,'',{title:'Dune',slug:'dune'}),-1);
});
test('LookMovie rejects ambiguous exact-title/year rows and accepts unique IMDb',async()=>{
 const q=load();
 const rows=[{title:'Dune',year:2021,slug:'dune-a'},{title:'Dune',year:2021,slug:'dune-b'}];
 q.setLookmovie(async()=>({body:JSON.stringify({result:rows})}));
 assert.equal(await q.findLookmovieHit('movie','Dune',2021,'',{}),null);
 rows.push({title:'Dune',year:2021,slug:'1160419-dune'});
 assert.equal((await q.findLookmovieHit('movie','Dune',2021,'1160419',{})).slug,'1160419-dune');
});
test('LookMovie exact season dictionary never substitutes another season',()=>{
 const q=load(),list={'1':{'1':{id_episode:'43221'}},'2':{'1':{id_episode:'44026'}}};
 assert.equal(q.pickLookmovieEpisodeId(list,2,1),'44026');
 assert.equal(q.pickLookmovieEpisodeId(list,3,1),null);
 assert.equal(q.pickLookmovieEpisodeId(list,2,2),null);
 assert.equal(q.pickLookmovieEpisodeId(list,0,1),null);
});
test('LookMovie observed Ted Lasso array keeps numeric season keys including zero',()=>{
 const q=load(),list=[{'7':{id_episode:'156983'}},{'1':{id_episode:'102181'}},{'1':{id_episode:'133653'}},[{id_episode:'230346'},{id_episode:'218862'}],{'1':{id_episode:'448653'}}];
 assert.equal(q.pickLookmovieEpisodeId(list,1,1),'102181');
 assert.equal(q.pickLookmovieEpisodeId(list,2,1),'133653');
 assert.equal(q.pickLookmovieEpisodeId(list,3,1),'218862');
 assert.equal(q.pickLookmovieEpisodeId(list,4,1),'448653');
 assert.equal(q.pickLookmovieEpisodeId(list,5,1),null);
 assert.equal(q.pickLookmovieEpisodeId(list,2,7),null);
});
test('LookMovie rejects explicit episode metadata contradicting its numeric key',()=>{
 const q=load();
 assert.equal(q.pickLookmovieEpisodeId({'2':{'1':{id_episode:'123',season:1,episode:1}}},2,1),null);
 assert.equal(q.pickLookmovieEpisodeId({'2':{'1':{id_episode:'123',season_number:2,episode_number:2}}},2,1),null);
});
test('live Gladiator search fixture never substitutes a sequel or similarly named film',async()=>{
 const q=load(),fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'results/lookmovie-gladiator-identity.json')));
 q.setLookmovie(async()=>({body:JSON.stringify({result:fixture.rows})}));
 assert.equal(await q.findLookmovieHit('movie','Gladiator',2000,'0172495',{}),null);
});
test('100 overlapping explicit retries dispatch only one quarantined-provider probe',async()=>{
 const q=load(),d=deferred();quarantine(q);let calls=0;
 const j=job(async p=>{calls++;await d.promise;return [{url:'https://media.test/'+p.id}];});
 const attempts=Array.from({length:100},(_,i)=>q.resolveProviderWithRetries(j,{...parsed,id:String(i)},true));
 await new Promise(r=>setImmediate(r));assert.equal(calls,1);d.resolve();
 const results=await Promise.all(attempts);assert.equal(results.filter(x=>x.length).length,1);
 assert.equal(results[0][0].url,'https://media.test/0');
});
