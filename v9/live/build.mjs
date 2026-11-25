// This side catalogue never writes to the root index, catalogue, or bundle.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
import {execFileSync as exec} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(dir,'../..');
const [lane,revision]=process.argv.slice(2);
assert.ok(['test','official'].includes(lane));
assert.match(revision,/^[a-f0-9]{40}$/);
const repo=lane==='official'?'Synthetiq-Modules':'Module-Testing-PL';
const repoId=lane==='official'?'synthetiq-official-v9-live':'module-testing-pl-v9-live';
const feedRoot=JSON.parse(fs.readFileSync(path.join(root,'repository.json')));
assert.equal(feedRoot.repositoryId,lane==='official'?'synthetiq-official-modules':'module-testing-pl');
const sigOpts=key=>({key,dsaEncoding:'ieee-p1363'});
const hash=b=>createHash('sha256').update(b).digest('hex');
const list=(...parts)=>parts.join('\n');
const moduleMsg=m=>list(m.moduleId,m.version,m.moduleFamilyId,m.moduleIdentity,m.moduleIdentityNumber,m.contentType,m.minAppVersion,m.publishedAtMs,m.packagePath,m.sha256);
const bundleMsg=(i,b)=>list('bundle',b.version,b.minAppVersion,i.publishedAtMs,b.packagePath,b.sha256);
const indexMsg=i=>list(i.schemaVersion,i.repositoryId,i.name,i.enabled,i.publishedAtMs,i.bundle.signature,...i.modules.map(m=>m.signature));
const fixed=[
 ['dw-live-v1','DW-Live-0.1.0-beta.4.zip','20a1bcee77a5e1f909547431f95912eb23f2d48cb3853d567d77acd547dd6405','DW'],
 ['public-sports-live-v1','Public-Sports-Live-0.1.0-beta.5.zip','41dff901e53ba0269a04b644b7a59c675dbcab4b4b40198a4b2e4040a596d094','Public Sports'],
 ['public-tv-live-v1','Public-TV-Live-0.1.0-beta.5.zip','34fc7e1a54aec2686935e681d2e1637ff51fe2ac4690d739510662ee9ac0898c','Public TV'],
];
const floor='9.0.112', bundleName='Player-V9-Live-1.zip';
const asset=n=>path.join(dir,'artifacts',n);
const members=exec('unzip',['-Z1',asset(bundleName)],{encoding:'utf8'}).trim().split('\n');
assert.deepEqual(members.sort(),fixed.map(x=>x[1]).sort());
const descriptor=n=>{
  const packagePath='/kas021/'+repo+'/'+revision+'/v9/live/artifacts/'+n;
  return {packagePath,packageUrl:'https://raw.githubusercontent.com'+packagePath,sha256:hash(fs.readFileSync(asset(n)))};
};
const idx={schemaVersion:1,repositoryId:repoId,name:'Synthetiq Player V9 Live TV',enabled:true,
  publishedAtMs:1795647480000,bundle:{version:1,minAppVersion:floor,...descriptor(bundleName)},modules:[]};
for(const [id,n,sha,purpose] of fixed){
  const d=descriptor(n);
  assert.equal(d.sha256,sha);
  assert.equal(hash(exec('unzip',['-p',asset(bundleName),n])),sha);
  const m=JSON.parse(exec('unzip',['-p',asset(n),'module.json']));
  assert.equal(m.id,id);
  assert.ok(!m.config?.sourceFallbacks && !m.config?.catalogueMapping);
  idx.modules.push({moduleId:id,moduleFamilyId:m.moduleFamilyId,moduleIdentity:m.moduleIdentity,
    moduleIdentityNumber:m.moduleIdentityNumber,contentType:'video',version:m.moduleVersion,
    minAppVersion:floor,publishedAtMs:idx.publishedAtMs,...d,
    presentation:{category:'Live TV',purpose,recommended:false},changelog:['Optional V9 Live TV catalogue; existing source selections are unchanged.']});
}
assert.equal(new Set(idx.modules.map(m=>m.moduleIdentityNumber)).size,3);
const disable=process.env.V9_DISABLE==='1';
if(process.env.V9_VERIFY_PUBLIC==='1' && !disable){
  for(const d of [idx.bundle,...idx.modules]){
    const response=await fetch(d.packageUrl,{redirect:'error',signal:AbortSignal.timeout(20000)});
    assert.equal(response.status,200);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())),d.sha256);
  }
}
const dest=path.join(dir,'repository.json');
if(lane==='official'){
  assert.equal(process.env.GITHUB_REPOSITORY,'kas021/Synthetiq-Modules');
  assert.equal(process.env.GITHUB_REF,'refs/heads/main');
  assert.equal(process.env.GITHUB_SHA,revision);
  assert.equal(process.env.V9_VERIFY_PUBLIC,'1');
}
let jwk;
if(lane==='official') jwk=JSON.parse(process.env.MODULE_REPOSITORY_SIGNING_JWK);
else {
  const p=process.env.SYNTHETIQ_TEST_SIGNING_JWK||path.join(os.homedir(),'.config/synthetiq/module-testing-signing.jwk');
  const st=fs.lstatSync(p);
  assert.ok(st.isFile() && st.uid===process.getuid() && (st.mode&0o077)===0);
  jwk=JSON.parse(fs.readFileSync(p));
}
const key=createPrivateKey({key:jwk,format:'jwk'}),pub=createPublicKey(key);
if(lane==='official'){
  assert.ok(verify('sha256',Buffer.from(indexMsg(feedRoot)),sigOpts(pub),Buffer.from(feedRoot.signature,'base64')));
}else{
  const {x,y}=pub.export({format:'jwk'});
  assert.equal(x,'2VzSrHdi6iUPAiXKHef5_oetwLVJcg1Zf_GPgP2SzgQ');
  assert.equal(y,'jTmpxbakMpLQ3aF97g3CgUxX91e-pv-2mJbkZw4oxHM');
}
const signed=msg=>{
  const b=Buffer.from(msg),s=sign('sha256',b,sigOpts(key));
  assert.ok(verify('sha256',b,sigOpts(pub),s));return s.toString('base64');
};
if(disable){
  const prior=fs.readFileSync(dest), old=JSON.parse(prior);
  const request=JSON.parse(fs.readFileSync(path.join(dir,'disable.json')));
  assert.deepEqual(request,{operation:'disable',expectedIndexSha256:hash(prior)});
  assert.equal(old.repositoryId,repoId);assert.equal(old.enabled,true);
  assert.ok(verify('sha256',Buffer.from(indexMsg(old)),sigOpts(pub),Buffer.from(old.signature,'base64')));
  assert.ok(verify('sha256',Buffer.from(bundleMsg(old,old.bundle)),sigOpts(pub),Buffer.from(old.bundle.signature,'base64')));
  for(const m of old.modules)assert.ok(verify('sha256',Buffer.from(moduleMsg(m)),sigOpts(pub),Buffer.from(m.signature,'base64')));
  old.enabled=false;
  old.publishedAtMs=Math.max(Date.now(),old.publishedAtMs+1);
  old.bundle.signature=signed(bundleMsg(old,old.bundle));old.signature=signed(indexMsg(old));
  fs.writeFileSync(dest+'.next',JSON.stringify(old,null,2)+'\n',{flag:'wx'});
  fs.renameSync(dest+'.next',dest);
  console.log('Signed scoped disable; immutable packages, installed data and root unchanged.');
  process.exit(0);
}
for(const m of idx.modules)m.signature=signed(moduleMsg(m));
idx.bundle.signature=signed(bundleMsg(idx,idx.bundle));
idx.signature=signed(indexMsg(idx));
fs.writeFileSync(dest,JSON.stringify(idx,null,2)+'\n',{flag:'wx'});
console.log('Verified and signed three immutable optional V9 sources; no root file changed.');
