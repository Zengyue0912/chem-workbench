import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {createHash} from 'node:crypto';

const APP='chem-learning-trial/1';
const digest=value=>createHash('sha256').update(value).digest('hex');
function canonical(value){let p=path.resolve(value);try{p=fs.realpathSync(p);}catch{}return process.platform==='win32'?p.toLowerCase():p;}
export function localIdentity(root,dataDir){
 const installationId=digest(canonical(root));
 return {app:APP,installationId,instanceId:digest(installationId+'|'+canonical(dataDir))};
}
export function writeLegacyMarker(root){
 // Older running versions already serve this directory, so they can be identified without stopping them.
 const marker=localIdentity(root,path.join(root,'.private'));
 fs.writeFileSync(path.join(root,'public','local-instance.json'),JSON.stringify(marker));
}
export function portAvailable(port){return new Promise(resolve=>{
 const probe=net.createServer();probe.once('error',()=>resolve(false));
 probe.listen({port,host:'127.0.0.1',exclusive:true},()=>probe.close(()=>resolve(true)));
});}
export async function sameWorkbench(port,identity,allowLegacy=false){
 const origin='http://127.0.0.1:'+port;
 try{
  const r=await fetch(origin+'/api/data/health',{signal:AbortSignal.timeout(1200),redirect:'error'});
  if(!r.ok)return false;const data=await r.json();
  if(data.app!==APP||data.mode!=='local'||data.configured!==true)return false;
  if(data.instanceId)return data.instanceId===identity.instanceId;
  if(!allowLegacy)return false;
  const markerResponse=await fetch(origin+'/local-instance.json',{signal:AbortSignal.timeout(1200),redirect:'error'});
  if(!markerResponse.ok)return false;const marker=await markerResponse.json();
  return marker.app===APP&&marker.installationId===identity.installationId&&marker.instanceId===identity.instanceId;
 }catch{return false;}
}
export async function selectPort(first,identity,allowLegacy=false,count=21){
 if(!Number.isInteger(first)||first<1||first>65535)throw Error('启动端口设置不正确，请使用1到65535之间的整数。');
 let free=null;
 for(let port=first;port<Math.min(first+count,65536);port++){
  if(await portAvailable(port)){if(free===null)free=port;}
  else if(await sameWorkbench(port,identity,allowLegacy))return {port,reused:true};
 }
 if(free!==null)return {port:free,reused:false};
 throw Error('附近端口都在使用中，请关闭多余的工作台窗口后重试。');
}
