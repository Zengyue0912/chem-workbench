import {getStore} from '@netlify/blobs';
import {createApp,hashPassword} from '../../server/core.mjs';
import {createStudyModel} from '../../server/study-model.mjs';
const studyModel=createStudyModel(process.env);
export default async (request,context)=>{
 const password=process.env.CHEM_ADMIN_PASSWORD||'',secret=process.env.CHEM_SESSION_SECRET||'',collectionCode=process.env.CHEM_COLLECTION_CODE||'';
 const config={mode:'cloud',secret,collectionCode,adminSalt:'chem-studio-cloud-admin-v1',adminHash:password.length>=12?hashPassword(password,'chem-studio-cloud-admin-v1'):'',siteUrl:process.env.URL||process.env.CHEM_SITE_URL,clientIP:()=>context.ip||'unknown',studyModel};
 const store=getStore({name:'chem-learning-v1',consistency:'strong'});return createApp({store,config}).handle(request);
};
