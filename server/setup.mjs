import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import readline from 'node:readline';
import {execFile} from 'node:child_process';
import {localIdentity,writeLegacyMarker,selectPort} from './startup.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.resolve(process.env.CHEM_DATA_DIR||path.join(root,'.private'));
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<16)){console.error('需要 Node.js 22.16 或以上版本。');process.exit(1);}
async function question(prompt,hidden=false){
 if(!process.stdin.isTTY)throw Error('首次运行需要在可输入的窗口设置密码和参加码。');
 if(!hidden){const r=readline.createInterface({input:process.stdin,output:process.stdout});return await new Promise(resolve=>r.question(prompt,v=>{r.close();resolve(v.trim());}));}
 return await new Promise(resolve=>{let text='';process.stdout.write(prompt);readline.emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);const done=(s,k)=>{if(k?.ctrl&&k.name==='c'){process.stdin.setRawMode(false);process.exit(1);}if(k?.name==='return'){process.stdin.setRawMode(false);process.stdin.off('keypress',done);process.stdout.write('\n');resolve(text);return;}if(k?.name==='backspace'){if(text){text=text.slice(0,-1);process.stdout.write('\b \b');}}else if(s&&!k?.ctrl&&!k?.meta){text+=s;process.stdout.write('*');}};process.stdin.on('keypress',done);});
}
try{
 writeLegacyMarker(root);
 const identity=localIdentity(root,dir),preferred=Number(process.env.CHEM_PORT||8890);
 const target=await selectPort(preferred,identity,!process.env.CHEM_DATA_DIR);
 const url='http://127.0.0.1:'+target.port+'/';
 const openBrowser=()=>{if(process.platform==='win32'&&process.env.CHEM_NO_BROWSER!=='1')execFile('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true},()=>{});};
 if(target.reused){
  console.log('工作台已经在运行，直接打开原来的页面，不会重复启动。');
  console.log('工作台：'+url);console.log('教师后台：'+url+'teacher.html');
  openBrowser();
 }else{
 process.env.CHEM_PORT=String(target.port);
 if(target.port!==preferred)console.log('原端口正在使用，已自动改用 '+target.port+'，不会关闭其他程序。');
 if(!fs.existsSync(path.join(dir,'settings.json'))&&!process.env.CHEM_ADMIN_PASSWORD){
  console.log('首次启动：设置教师密码和学生参加码。密码不会显示在屏幕上。');
  const password=await question('教师密码（至少12位）：',true),confirmation=await question('再次输入教师密码：',true),code=await question('学生参加码（至少6位）：');
  if(password.length<12||password!==confirmation||code.length<6||code===password)throw Error('请确认两次密码一致，教师密码至少12位，参加码至少6位且与密码不同。');
  process.env.CHEM_ADMIN_PASSWORD=password;process.env.CHEM_COLLECTION_CODE=code;
 }
 const {ready}=await import('./local.mjs');
 await ready;
 delete process.env.CHEM_ADMIN_PASSWORD;delete process.env.CHEM_COLLECTION_CODE;
 openBrowser();
 }
}catch(e){console.error(e.code==='EADDRINUSE'?'端口刚被另一个程序占用，请再次双击启动；已有工作台不受影响。':'启动失败：'+e.message);process.exitCode=1;}
