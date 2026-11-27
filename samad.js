(function(){
'use strict';
if (window.SAMAD_APP && window.SAMAD_APP.installed) return;
const norm=s=>(s||'').replace(/\\s+/g,' ').trim();
const attr=(e,n)=>e.getAttribute(n)||'';
const hidden=(scope,n)=>{const e=scope?.querySelector(`[name$=".${n}"]`);return e?.value||''};
const identity=x=>[x.foodId,x.date,x.mealTypeId,x.foodTypeId,location.href].map(v=>String(v||'')).join('::');
let foods=[], selected=new Set(), scanTimer=null, reloadTimer=null, busy=false;
try { const saved=JSON.parse(localStorage.getItem('samadRooConfig')||'null'); if(saved?.selected) selected=new Set(saved.selected); } catch(e) {}

function collect(){
 return [...document.querySelectorAll('input[type=checkbox]')].filter(e=>(e.name||'').includes('userWeekReserves')&&(e.name||'').endsWith('.selected')).map((e,i)=>{
  const row=e.closest('tr')||e.parentElement, id=e.id||'', lab=id?[...document.querySelectorAll('label[for]')].find(x=>x.htmlFor===id):null;
  const name=norm(lab?.textContent)||norm(row?.innerText)||`غذای ${i+1}`;
  const x={name,foodId:attr(e,'foodid')||hidden(row,'foodId'),date:attr(e,'programdate')||hidden(row,'programDateTime'),mealTypeId:attr(e,'mealtypeid')||hidden(row,'mealTypeId'),foodTypeId:attr(e,'foodtypeid')||hidden(row,'foodTypeId'),id,disabled:e.disabled};
  x.key=identity(x); x.element=e; return x;
 }).filter(x=>x.foodId||x.id);
}
function panel(){
 let p=document.getElementById('samad-roo-panel'); if(p)return p;
 p=document.createElement('section');p.id='samad-roo-panel';
 p.style.cssText='position:fixed;z-index:2147483647;top:8px;right:8px;width:min(330px,90vw);max-height:48vh;overflow:auto;background:#fff;color:#17212b;border:2px solid #176b55;border-radius:12px;padding:10px;font:14px Tahoma;box-shadow:0 4px 18px #0005;direction:rtl';
 p.innerHTML='<b>رزرویار سلف گیلان</b><div id="samad-food-list" style="margin-top:8px"></div><div id="samad-roo-state" style="margin-top:8px;font-size:12px;white-space:pre-wrap">آماده</div>';
 document.body.appendChild(p); return p;
}
function report(t){panel();document.getElementById('samad-roo-state').textContent=t;try{SamadBridge.report(t)}catch(e){}}
function scan(){
 foods=collect();const box=document.getElementById('samad-food-list');if(!box)return;
 box.replaceChildren();
 if(!foods.length){box.textContent='غذایی پیدا نشد؛ صفحه منوی غذا را باز کنید.';report('اسکن انجام شد؛ غذایی پیدا نشد.');return}
 foods.forEach(x=>{const l=document.createElement('label');l.style.cssText='display:flex;gap:8px;padding:5px 0;border-bottom:1px solid #eee';
 const c=document.createElement('input');c.type='checkbox';c.checked=selected.has(x.key);c.onchange=()=>c.checked?selected.add(x.key):selected.delete(x.key);
 const s=document.createElement('span');s.textContent=x.name;l.append(c,s);box.append(l)});
 report(`${foods.length} غذا پیدا شد. فقط نام غذاها نمایش داده می‌شود.`);
}
function stop(clearConfig=true){clearInterval(scanTimer);clearTimeout(reloadTimer);scanTimer=reloadTimer=null;if(clearConfig)localStorage.removeItem('samadRooConfig');report('پایش متوقف شد.');}
function result(text){report(text);busy=false;}
async function reserve(x){
 if(busy)return;busy=true;stop();let lock='';try{lock=SamadBridge.getLock()}catch(e){}
 if(lock){result('قفل یک‌باره قبلاً ثبت شده؛ برای جلوگیری از رزرو تکراری ادامه داده نشد.');return}
 try{SamadBridge.saveLock(x.key)}catch(e){}
 const cb=foods.find(y=>y.key===x.key)?.element;
 if(!cb||cb.disabled){result('غذای انتخاب‌شده دیگر در دسترس نیست.');return}
 if(!cb.checked){cb.click();await new Promise(r=>setTimeout(r,200))}
 if(!cb.checked){result('انتخاب غذا توسط سایت تأیید نشد؛ دکمه رزرو زده نشد.');return}
 const btn=document.querySelector('#doReservBtn');
 if(!btn||btn.disabled){result('دکمه تأیید رزرو در صفحه پیدا نشد یا غیرفعال است.');return}
 const before=norm(document.body.innerText);btn.click();
 setTimeout(()=>{const now=norm(document.body.innerText);
  if(now!==before && /رزرو.{0,20}موفق|ثبت.{0,20}موفق/.test(now))result('پیام موفقیت رزرو در صفحه مشاهده شد؛ وضعیت را در سامانه بررسی کنید.');
  else if(/خطا در رزرو|رزرو ناموفق|ظرفیت.{0,10}تکمیل/.test(now))result('سامانه پیام خطا یا عدم امکان رزرو نشان داد.');
  else result('درخواست ارسال شد، اما پیام قطعی موفقیت یا خطا تشخیص داده نشد؛ رزرو را در سامانه بررسی کنید.');
 },5500);
}
function start(ms){
 if(!selected.size){report('ابتدا حداقل یک غذا را انتخاب کنید.');return}
 localStorage.setItem('samadRooConfig',JSON.stringify({selected:[...selected],interval:Math.max(3000,Number(ms)||5000)}));
 let lock='';try{lock=SamadBridge.getLock()}catch(e){}
 if(lock){report('قفل رزرو قبلی فعال است؛ برای تلاش جدید ابتدا نتیجه قبلی را بررسی و قفل را پاک کنید.');return}
 stop(false);scan();scanTimer=setInterval(()=>{foods=collect();const ready=foods.find(x=>selected.has(x.key)&&!x.disabled);if(ready){reserve(ready);return}scan()},500);
 const interval=Math.max(3000,Number(ms)||5000);
 reloadTimer=setTimeout(()=>{if(!busy&&scanTimer)location.reload()},interval);
 report('پایش شروع شد؛ بررسی محلی هر ۵۰۰ms و رفرش صفحه با فاصله تعیین‌شده انجام می‌شود.');
}
window.SAMAD_APP={installed:true,scan,start,stop,clearLock:()=>{try{SamadBridge.clearLock()}catch(e){}report('قفل محلی پاک شد.')}};
panel();scan();
try { const saved=JSON.parse(localStorage.getItem('samadRooConfig')||'null'); if(saved?.selected?.length){ selected=new Set(saved.selected); start(saved.interval||5000); } } catch(e) {}
})();