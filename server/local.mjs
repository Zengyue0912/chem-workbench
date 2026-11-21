import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createApp,hashPassword} from './core.mjs';
import {openSQLite} from './sqlite.mjs';
import {localIdentity} from './startup.mjs';
import {createLocalStudyModel} from './study-model.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),privateRoot=path.resolve(process.env.CHEM_DATA_DIR||path.join(root,'.private'));
fs.mkdirSync(privateRoot,{recursive:true});const settings=path.join(privateRoot,'settings.json');
let config=fs.existsSync(settings)?JSON.parse(fs.readFileSync(settings,'utf8')):{secret:randomBytes(48).toString('hex'),adminSalt:randomBytes(20).toString('hex')};
if(process.env.CHEM_ADMIN_PASSWORD){if(process.env.CHEM_ADMIN_PASSWORD.length<12)throw Error('教师密码至少12位。');config.adminHash=hashPassword(process.env.CHEM_ADMIN_PASSWORD,config.adminSalt);}
if(process.env.CHEM_COLLECTION_CODE){if(process.env.CHEM_COLLECTION_CODE.length<6)throw Error('参加码至少6位。');config.collectionCode=process.env.CHEM_COLLECTION_CODE;}
if(!config.adminHash||!config.collectionCode){console.error('首次使用请运行“启动体验.cmd”，设置教师密码和参加码。');process.exit(1);}
fs.writeFileSync(settings,JSON.stringify(config,null,2));
const store=openSQLite(path.join(privateRoot,'learning.sqlite')),port=Number(process.env.CHEM_PORT||8890),publicRoot=path.join(root,'public');
const app=createApp({store,config:{...config,mode:'local',instanceId:localIdentity(root,privateRoot).instanceId,siteUrl:`http://127.0.0.1:${port}`,clientIP:req=>req.headers.get('x-chem-local-peer')||'loopback',studyModel:createLocalStudyModel(process.env)}});
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/markdown; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.vtt':'text/vtt; charset=utf-8','.mp4':'video/mp4','.wasm':'application/wasm'};
function serveVideo(req,res,file,headers,size){
 const range=req.headers.range;
 headers['Accept-Ranges']='bytes';
 let start=0,end=size-1,status=200;
 if(range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(match&&(match[1]||match[2])){
   start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
   end=match[1]&&match[2]?Math.min(end,Number(match[2])):end;
  }
  if(!match||(!match[1]&&!match[2])||start>=size||start>end){
   res.writeHead(416,{...headers,'Content-Range':`bytes */${size}`});
   return res.end();
  }
  status=206;
  headers['Content-Range']=`bytes ${start}-${end}/${size}`;
 }
 res.writeHead(status,{...headers,'Content-Length':end-start+1});
 if(req.method==='HEAD')return res.end();
 const stream=fs.createReadStream(file,{start,end});
 res.on('close',()=>stream.destroy());
 stream.on('error',()=>res.destroy());
 stream.pipe(res);
}
const server=http.createServer(async(req,res)=>{
 try{
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403);res.end('仅允许本机访问');return;}
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  if(url.pathname.startsWith('/api/data/')){
   let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>100000){res.writeHead(413);res.end('上传内容过大');return;}chunks.push(chunk);}
   const headers=new Headers(req.headers);headers.set('x-chem-local-peer',req.socket.remoteAddress||'loopback');
   const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
   const response=await app.handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const name=decodeURIComponent(url.pathname)==='/'?'/index.html':decodeURIComponent(url.pathname),file=path.resolve(publicRoot,'.'+name);
  if(!file.startsWith(publicRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('页面不存在');return;}
  const ext=path.extname(file),headers={'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
  if(ext==='.mp4')return serveVideo(req,res,file,headers,fs.statSync(file).size);
  res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:fs.readFileSync(file));
 }catch{if(!res.headersSent)res.writeHead(500);res.end('本机服务暂时不可用。');}
});
export const ready=new Promise((resolve,reject)=>{
 server.once('error',error=>{store.close();reject(error);});
 server.listen(port,'127.0.0.1',()=>{console.log('工作台：http://127.0.0.1:'+port+'/');console.log('教师后台：http://127.0.0.1:'+port+'/teacher.html');console.log('当前是本机体验，数据保存在本机SQLite；云端部署说明见压缩包文档。');resolve({port});});
});
ready.catch(error=>{if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){console.error(error.code==='EADDRINUSE'?'此端口已有程序运行，请使用“启动体验.cmd”自动打开或选择可用端口。':'本机服务启动失败：'+error.message);process.exitCode=1;}});
process.on('SIGINT',()=>server.close(()=>{store.close();process.exit();}));
