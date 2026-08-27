const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY="warenwirtschaft_pwa_v1";
let db=JSON.parse(localStorage.getItem(KEY)||'{"products":[],"movements":[],"productions":[]}');
if(!db.productions)db.productions=[];
let currentProduct=null, moveType="in", deferredPrompt=null;
const num=v=>Number(String(v||"").replace(",", "."))||0;
const int=v=>Math.max(0,parseInt(v||"0",10)||0);
const money=n=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n||0);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function save(){localStorage.setItem(KEY,JSON.stringify(db));render()}
function toast(t){$("#toast").textContent=t;$("#toast").classList.add("show");setTimeout(()=>$("#toast").classList.remove("show"),1500)}
function nav(id){$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));$$("nav [data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===id))}
$$("[data-nav]").forEach(b=>b.onclick=()=>nav(b.dataset.nav));
$("#today").textContent=new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date());

function render(){
 $("#statProducts").textContent=db.products.length;
 $("#statStock").textContent=db.products.reduce((s,p)=>s+p.stock,0);
 $("#statLow").textContent=db.products.filter(p=>p.min>0&&p.stock<=p.min).length;
 $("#statValue").textContent=money(db.products.reduce((s,p)=>s+p.purchase*p.stock,0));
 $("#repRevenue").textContent=money(db.products.reduce((s,p)=>s+p.selling*p.stock,0));
 $("#repProfit").textContent=money(db.products.reduce((s,p)=>s+(p.selling-p.purchase)*p.stock,0));
 const q=$("#search").value.toLowerCase();
 const ps=db.products.filter(p=>[p.name,p.article,p.barcode,p.category].some(x=>String(x||"").toLowerCase().includes(q)));
 $("#productList").innerHTML=ps.map(p=>`<div class="item"><div><strong>${esc(p.name)}</strong><div class="meta">${esc(p.category||"Ohne Kategorie")} · ${esc(p.barcode||"kein Code")}</div></div><div class="right"><strong class="${p.min>0&&p.stock<=p.min?"low":""}">${p.stock} Stk.</strong><div class="meta">${money(p.selling)}</div><button class="edit" data-id="${p.id}">Bearbeiten</button></div></div>`).join("")||'<p class="meta">Noch keine Artikel.</p>';
 $("#stockList").innerHTML=db.products.map(p=>`<div class="item"><div><strong>${esc(p.name)}</strong><div class="meta">EK ${money(p.purchase)} · VK ${money(p.selling)}</div></div><div class="right"><strong>${p.stock} Stk.</strong><br><button class="book" data-id="${p.id}">Buchen</button></div></div>`).join("")||'<p class="meta">Noch keine Artikel.</p>';
 $("#qrProductSelect").innerHTML=db.products.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
 $("#rawProduct").innerHTML=db.products.map(p=>`<option value="${p.id}">${esc(p.name)} (${p.stock} Stk.)</option>`).join("");
 $("#activityList").innerHTML=[...db.productions.map(x=>({time:x.time,text:`${x.qty}x ${x.finishedName} produziert`,sub:`Charge ${x.charge}`})),...db.movements.map(x=>({time:x.time,text:`Lagerbuchung ${x.type==="in"?"+":x.type==="out"?"−":""}${x.qty}`,sub:db.products.find(p=>p.id===x.productId)?.name||"Artikel"}))].sort((a,b)=>b.time-a.time).slice(0,5).map(a=>`<div class="item"><div><strong>${esc(a.text)}</strong><div class="meta">${esc(a.sub)}</div></div><div class="meta">${new Date(a.time).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</div></div>`).join("")||'<p class="meta">Noch keine Aktivitäten.</p>';
 $("#productionList").innerHTML=db.productions.slice().reverse().map(x=>`<div class="item"><div><strong>${esc(x.finishedName)}</strong><div class="meta">${esc(x.charge)}</div></div><div class="right">${x.qty} Stk.</div></div>`).join("");
 $$(".edit").forEach(x=>x.onclick=()=>openProduct(x.dataset.id));$$(".book").forEach(x=>x.onclick=()=>openStock(x.dataset.id));calc();
}
$("#search").oninput=render;

function openProduct(id=null){
 const p=db.products.find(x=>x.id===id); $("#pid").value=p?.id||"";$("#name").value=p?.name||"";$("#article").value=p?.article||"";$("#barcode").value=p?.barcode||"";$("#category").value=p?.category||"";$("#purchase").value=p?.purchase||"";$("#selling").value=p?.selling||"";$("#stockQty").value=p?.stock??0;$("#minStock").value=p?.min??0;$("#productDialog").showModal();
}
$("#newBtn").onclick=()=>openProduct();$("#closeProduct").onclick=()=>$("#productDialog").close();
$("#productForm").onsubmit=e=>{e.preventDefault();const p={id:$("#pid").value||uid(),name:$("#name").value.trim(),article:$("#article").value.trim(),barcode:$("#barcode").value.trim(),category:$("#category").value.trim(),purchase:num($("#purchase").value),selling:num($("#selling").value),stock:int($("#stockQty").value),min:int($("#minStock").value)};const i=db.products.findIndex(x=>x.id===p.id);if(i>=0)db.products[i]=p;else db.products.push(p);save();$("#productDialog").close();toast("Gespeichert")};

function openStock(id){currentProduct=db.products.find(x=>x.id===id);moveType="in";$("#stockName").textContent=currentProduct.name;$("#currentStock").textContent=currentProduct.stock;$("#moveQty").value="";$("#stockDialog").showModal()}
$("#closeStock").onclick=()=>$("#stockDialog").close();$$(".seg button").forEach(b=>b.onclick=()=>{moveType=b.dataset.type;$$(".seg button").forEach(x=>x.classList.toggle("active",x===b))});
$("#stockForm").onsubmit=e=>{e.preventDefault();const q=int($("#moveQty").value),before=currentProduct.stock;if(moveType==="out"&&q>before)return toast("Nicht genug Bestand");const after=moveType==="in"?before+q:moveType==="out"?before-q:q;currentProduct.stock=after;db.movements.push({id:uid(),productId:currentProduct.id,type:moveType,qty:q,before,after,note:$("#note").value.trim(),time:Date.now()});save();$("#stockDialog").close();toast("Bestand aktualisiert")};

$("#startProduction").onclick=()=>$("#productionDialog").showModal();$("#closeProduction").onclick=()=>$("#productionDialog").close();
$("#productionForm").onsubmit=e=>{e.preventDefault();const raw=db.products.find(p=>p.id===$("#rawProduct").value),q=int($("#prodQty").value),name=$("#finishedName").value.trim();if(!raw||!name||q<=0)return;if(q>raw.stock)return toast("Nicht genug Rohware");raw.stock-=q;const extra=num($("#prodExtraCost").value),sell=num($("#prodSelling").value),charge="CH-"+new Date().getFullYear()+"-"+String(db.productions.length+1).padStart(4,"0");let finished=db.products.find(p=>p.name===name);if(!finished){finished={id:uid(),name,article:"",barcode:"WAWI-"+uid(),category:"Veredelung",purchase:raw.purchase+extra,selling:sell,stock:0,min:0};db.products.push(finished)}finished.stock+=q;db.productions.push({id:uid(),rawProductId:raw.id,finishedProductId:finished.id,finishedName:name,qty:q,charge,time:Date.now()});save();$("#productionDialog").close();toast("Veredelung gebucht")};

$("#generateQr").onclick=()=>{const p=db.products.find(x=>x.id===$("#qrProductSelect").value);if(!p)return;const code=p.barcode||("WAWI:"+p.id);$("#qrcode").innerHTML="";new QRCode($("#qrcode"),{text:code,width:256,height:256});$("#qrCodeText").textContent=p.name+" · "+code};

function calc(){const ek=num($("#ek").value),vk=num($("#vk").value),q=int($("#qty").value),ship=num($("#ship").value),fees=num($("#fees").value),other=num($("#other").value),rev=vk*q,cost=ek*q+ship+fees+other,prof=rev-cost,mar=rev?prof/rev*100:0;$("#revenue").textContent=money(rev);$("#costs").textContent=money(cost);$("#profit").textContent=money(prof);$("#margin").textContent=mar.toFixed(2).replace(".",",")+" %"}
["ek","vk","qty","ship","fees","other"].forEach(id=>$("#"+id).oninput=calc);

$("#exportBtn").onclick=()=>{const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="lagerpro-backup.json";a.click();URL.revokeObjectURL(a.href)};
$("#importFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{db=JSON.parse(await f.text());if(!db.productions)db.productions=[];save();toast("Importiert")}catch{toast("Ungültige Datei")}};
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installBtn").hidden=false});$("#installBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("#installBtn").hidden=true};
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw-v4.js").catch(()=>{});
render();