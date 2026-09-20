import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function status(c){const now=Date.now(),s=new Date(c.startTime).getTime(),e=c.endTime?new Date(c.endTime).getTime():s+3600000;if(now>=s&&now<=e)return ['LIVE NOW','live'];if(now<s)return ['UPCOMING','upcoming'];return ['ENDED','ended'];}
function format(v){const d=new Date(v);return isNaN(d)?v:d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});}
async function loadStudentLiveClasses(){
 const box=document.getElementById('liveClassesList'); if(!box)return;
 box.innerHTML='<p style="color:#cbd5e1">Loading...</p>';
 try{
  const snap=await getDocs(collection(db,'liveClasses'));
  const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime));
  const active=rows.filter(c=>status(c)[1]!=='ended');
  box.innerHTML=active.length?active.map(c=>{const [st,cl]=status(c);return `<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:15px;margin-bottom:12px"><h3 style="margin:0 0 7px">🔴 ${esc(c.title||'Live Class')}</h3><div style="color:#cbd5e1;line-height:1.7"> <b style="color:${cl==='live'?'#4ade80':'#facc15'}">${st}</b><br>👨‍🏫 ${esc(c.teacher||'Faculty')} · 📚 ${esc(c.course||'')}<br>🕐 ${format(c.startTime)}${c.endTime?' → '+format(c.endTime):''}<br>${esc(c.description||'')}</div><a href="${esc(c.liveUrl||'#')}" target="_blank" rel="noopener" style="display:inline-block;margin-top:12px;padding:11px 16px;border-radius:9px;background:#dc2626;color:#fff;text-decoration:none;font-weight:bold">${cl==='live'?'▶ Join Live Class':'🔔 Open Class Link'}</a></div>`}).join(''):'<div style="text-align:center;color:#cbd5e1;padding:25px">अभी कोई upcoming/live class नहीं है।</div>';
 }catch(e){console.error(e);box.innerHTML='<div style="color:#fca5a5;padding:15px">Live classes load नहीं हो पाईं।</div>';}
}
window.loadStudentLiveClasses=loadStudentLiveClasses;
window.addEventListener('load',()=>{if(document.getElementById('liveClassesList'))loadStudentLiveClasses();});
