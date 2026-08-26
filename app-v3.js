
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY="warenwirtschaft_pwa_v1";
let db=JSON.parse(localStorage.getItem(KEY)||'{"products":[],"movements":[]}');
let currentProduct=null, moveType="in", stream=null, timer=null, deferredPrompt=null;

const num=v=>Number(String(v||"").replace(",", "."))||0;
const int=v=>Math.max(0,parseInt(v||"0",10)||0);
const money=n=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n||0);
const pct=n=>(n||0).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" %";
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function save(){localStorage.setItem(KEY,JSON.stringify(db));render();}
function toast(t){$("#toast").textContent=t;$("#toast").classList.add("show");setTimeout(()=>$("#toast").classList.remove("show"),1500);}
function nav(id){$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));$$("nav [data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===id));}
$$("[data-nav]").forEach(b=>b.onclick=()=>nav(b.dataset.nav));

function render(){
  $("#statProducts").textContent=db.products.length;
  $("#statValue").textContent=money(db.products.reduce((s,p)=>s+p.purchase*p.stock,0));
  $("#statLow").textContent=db.products.filter(p=>p.min>0&&p.stock<=p.min).length;
  $("#statProfit").textContent=money(db.products.reduce((s,p)=>s+(p.selling-p.purchase)*p.stock,0));
  const q=$("#search").value.toLowerCase();
  const ps=db.products.filter(p=>[p.name,p.article,p.barcode,p.category].some(x=>String(x||"").toLowerCase().includes(q)));
  $("#productList").innerHTML=ps.map(p=>`<div class="item open" data-id="${p.id}"><div><strong>${esc(p.name)}</strong><div class="meta">${esc(p.category||"Ohne Kategorie")} · ${esc(p.barcode||"kein Code")}</div></div><div class="right"><strong class="${p.min>0&&p.stock<=p.min?"low":""}">${p.stock} Stk.</strong><div class="meta">${money(p.selling)}</div><button class="qrBtn" data-id="${p.id}">▦ QR-Code</button></div></div>`).join("")||'<p class="hint">Noch keine Artikel.</p>';
  $("#stockList").innerHTML=db.products.map(p=>`<div class="item"><div><strong>${esc(p.name)}</strong><div class="meta">EK ${money(p.purchase)} · VK ${money(p.selling)}</div></div><div class="right"><strong>${p.stock} Stk.</strong><br><button class="book" data-id="${p.id}">Buchen</button></div></div>`).join("")||'<p class="hint">Noch keine Artikel.</p>';
  $$(".open").forEach(x=>x.onclick=()=>openProduct(x.dataset.id));
  $$(".qrBtn").forEach(x=>x.onclick=e=>{e.stopPropagation();openQr(x.dataset.id);});
  $$(".book").forEach(x=>x.onclick=()=>openStock(x.dataset.id));
  calc();
}
$("#search").oninput=render;

function openProduct(id=null,code=""){
  const p=db.products.find(x=>x.id===id);
  $("#pid").value=p?.id||""; $("#name").value=p?.name||""; $("#article").value=p?.article||""; $("#barcode").value=p?.barcode||code;
  $("#category").value=p?.category||""; $("#purchase").value=p?.purchase||""; $("#selling").value=p?.selling||""; $("#stockQty").value=p?.stock??0; $("#minStock").value=p?.min??0;
  $("#productDialog").showModal();
}
$("#newBtn").onclick=()=>openProduct();
$("#closeProduct").onclick=()=>$("#productDialog").close();
$("#productForm").onsubmit=e=>{
  e.preventDefault();
  const p={id:$("#pid").value||uid(),name:$("#name").value.trim(),article:$("#article").value.trim(),barcode:$("#barcode").value.trim(),category:$("#category").value.trim(),purchase:num($("#purchase").value),selling:num($("#selling").value),stock:int($("#stockQty").value),min:int($("#minStock").value)};
  if(!p.name)return toast("Produktname fehlt");
  if(p.barcode&&db.products.some(x=>x.barcode===p.barcode&&x.id!==p.id))return toast("Code schon vorhanden");
  const i=db.products.findIndex(x=>x.id===p.id); if(i>=0)db.products[i]=p;else db.products.push(p);
  save();$("#productDialog").close();toast("Gespeichert");
};

function openStock(id,type="in"){
  currentProduct=db.products.find(x=>x.id===id); if(!currentProduct)return;
  moveType=type; $("#stockName").textContent=currentProduct.name; $("#currentStock").textContent=currentProduct.stock; $("#moveQty").value=""; $("#note").value="";
  $$(".seg button").forEach(b=>b.classList.toggle("active",b.dataset.type===moveType)); $("#stockDialog").showModal();
}
$("#closeStock").onclick=()=>$("#stockDialog").close();
$$(".seg button").forEach(b=>b.onclick=()=>{moveType=b.dataset.type;$$(".seg button").forEach(x=>x.classList.toggle("active",x===b));});
$("#stockForm").onsubmit=e=>{
  e.preventDefault(); const q=int($("#moveQty").value), before=currentProduct.stock;
  if(moveType!=="set"&&q<=0)return toast("Menge eingeben");
  if(moveType==="out"&&q>before)return toast("Nicht genug Bestand");
  const after=moveType==="in"?before+q:moveType==="out"?before-q:q;
  currentProduct.stock=after; db.movements.push({id:uid(),productId:currentProduct.id,type:moveType,qty:q,before,after,note:$("#note").value.trim(),time:Date.now()});
  save();$("#stockDialog").close();toast("Bestand aktualisiert");
};

function calc(){
  const ek=num($("#ek").value),vk=num($("#vk").value),q=int($("#qty").value),ship=num($("#ship").value),fees=num($("#fees").value),other=num($("#other").value);
  const revenue=vk*q,costs=ek*q+ship+fees+other,profit=revenue-costs,margin=revenue?profit/revenue*100:0;
  $("#revenue").textContent=money(revenue);$("#costs").textContent=money(costs);$("#profit").textContent=money(profit);$("#margin").textContent=pct(margin);
}
["ek","vk","qty","ship","fees","other"].forEach(id=>$("#"+id).oninput=calc);

async function scan(){
  $("#scanDialog").showModal();$("#scanStatus").textContent="Kamera wird gestartet…";
  if(!("BarcodeDetector" in window)){ $("#scanStatus").textContent="Dieser Browser unterstützt automatisches Scannen nicht. Code bitte manuell eingeben."; return; }
  try{
    const detector=new BarcodeDetector();
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
    $("#video").srcObject=stream; await $("#video").play(); $("#scanStatus").textContent="Code vor die Kamera halten";
    const loop=async()=>{ if(!stream)return; try{const r=await detector.detect($("#video")); if(r.length){finishScan(r[0].rawValue);return;}}catch{} timer=setTimeout(loop,200);}; loop();
  }catch(e){$("#scanStatus").textContent="Kamera nicht verfügbar. Berechtigung prüfen oder Code manuell eingeben.";}
}
function stopScan(){ if(timer)clearTimeout(timer);timer=null;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;$("#scanDialog").close();}
function finishScan(code){ stopScan(); const p=db.products.find(x=>x.barcode===code); if(p){openStock(p.id,"in");toast("Produkt gefunden");}else{openProduct(null,code);toast("Neuen Artikel anlegen");} }
$("#scanBtn").onclick=scan;$("#scanStockBtn").onclick=scan;$("#scanForm").onclick=scan;$("#closeScan").onclick=stopScan;$("#useManual").onclick=()=>{const c=$("#manualCode").value.trim();if(c)finishScan(c);};


function qrPayload(p){
  return p.barcode || ("WAWI:"+p.id);
}
function openQr(id){
  const p=db.products.find(x=>x.id===id); if(!p)return;
  currentProduct=p;
  const code=qrPayload(p);
  $("#qrProductName").textContent=p.name;
  $("#qrCodeText").textContent="Code: "+code;
  $("#qrcode").innerHTML="";
  if(typeof QRCode==="undefined"){ toast("QR-Bibliothek konnte nicht geladen werden"); return; }
  new QRCode($("#qrcode"),{
    text:code,width:256,height:256,
    colorDark:"#000000",colorLight:"#ffffff",
    correctLevel:QRCode.CorrectLevel.M
  });
  $("#qrDialog").showModal();
}
$("#closeQr").onclick=()=>$("#qrDialog").close();

function qrCanvas(){
  return $("#qrcode canvas");
}
$("#saveQr").onclick=()=>{
  const c=qrCanvas();
  if(!c)return toast("QR-Code noch nicht bereit");
  const a=document.createElement("a");
  a.href=c.toDataURL("image/png");
  const safe=(currentProduct?.name||"produkt").replace(/[^a-z0-9äöüß_-]+/gi,"_");
  a.download="QR_"+safe+".png";
  a.click();
};
$("#shareQr").onclick=async()=>{
  const c=qrCanvas(); if(!c)return toast("QR-Code noch nicht bereit");
  try{
    const blob=await new Promise(r=>c.toBlob(r,"image/png"));
    const file=new File([blob],"produkt-qr.png",{type:"image/png"});
    if(navigator.share && navigator.canShare?.({files:[file]})){
      await navigator.share({title:currentProduct?.name||"Produkt QR-Code",files:[file]});
    }else{
      $("#saveQr").click();
      toast("Teilen nicht unterstützt – Bild gespeichert");
    }
  }catch(e){}
};


$("#exportBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="warenwirtschaft-backup.json";a.click();URL.revokeObjectURL(a.href);
};
$("#importFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{db=JSON.parse(await f.text());save();toast("Importiert");}catch{toast("Ungültige Datei");}};

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installBtn").hidden=false;});
$("#installBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("#installBtn").hidden=true;};

if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
render();
