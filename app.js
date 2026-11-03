(() => {
  const GUEST_DB_NAME = "aethelgard-local";
  const STORE = "entries";
  const themes = {
    "Obsidian": ["#11100f","#181715","#201e1b","#302c27","#e9e1d5","#968d80","#b58a58","#3a2d20"],
    "Nocturne": ["#10131b","#171c27","#202838","#30394a","#e2e6ef","#929db0","#9baecb","#29354a"],
    "Imperial": ["#1b1013","#24171b","#302025","#493039","#eee1dc","#a99591","#bd946c","#432b2d"],
    "Parchment": ["#e9dfca","#f1e8d7","#e4d8c1","#c8b99c","#352d22","#786b58","#916b3f","#dfcfb2"],
    "Monolith": ["#17191b","#202326","#292d30","#3a4044","#e4e6e7","#9ba1a4","#a9afb2","#343a3d"],
    "Versailles": ["#e9e1d3","#f3ecdf","#e7dece","#cfc2ac","#3b3329","#817666","#a17d4e","#dfd1bb"],
    "Renaissance": ["#171a14","#20251b","#2a3023","#414a36","#e6e4d4","#a3a18c","#b5a36c","#343b28"],
    "Midnight": ["#0e1420","#151e2d","#1d2a3d","#2d405a","#e3e9f2","#96a6bd","#829fc5","#263c59"],
    "Eclipse": ["#0e0d0c","#171513","#211e1a","#373027","#e8dfd2","#9b8d7a","#b17a48","#3d2b1d"],
    "Oxford": ["#111914","#19241d","#233128","#35483a","#e4e8dc","#9eaa9d","#b1a47b","#2b3c30"],
    "Sepia": ["#211a14","#2a2119","#382c20","#514131","#eee0cb","#b5a187","#c19462","#493622"],
    "Aurelian": ["#17121e","#211a2b","#2c2339","#453653","#eee5f4","#a99bb8","#c1a0cf","#3d2b4a"],
    "Arctic": ["#e7edf0","#f2f6f7","#dce5e9","#c0cdd3","#25343b","#697c85","#6b929d","#d0dfe4"],
    "Bloodstone": ["#190f11","#241619","#321e22","#4b2b31","#eee0e1","#a99194","#b66b70","#47272e"],
    "Emerald": ["#101914","#18251e","#213329","#344b3d","#e2e9df","#9cab9b","#b0a06b","#2d4335"],
    "Graphite": ["#171717","#202020","#292929","#3c3c3c","#ededed","#a0a0a0","#b9b9b9","#333333"],
    "Celestial": ["#111321","#1a1d31","#242842","#3a4164","#e7e6f2","#a3a5c0","#a59bcf","#343653"],
    "Copperfield": ["#1d1511","#291d17","#38271e","#533b2c","#eee0d3","#b29a88","#c18458","#4a3022"],
    "Porcelain": ["#f1f0ed","#faf9f6","#e9e7e2","#d4d1c9","#292824","#77756e","#9b8058","#e3dfd6"],
    "Abyss": ["#0e1718","#142122","#1c2d2e","#2d4445","#e0e9e6","#91a7a3","#83aaa0","#263b3c"]
  };
  const $ = id => document.getElementById(id);
  let db, entries = [], currentId = null, mode = "rich", saveTimer;
  const openDB = (name=GUEST_DB_NAME) => new Promise((resolve,reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => { const d=req.result; if(!d.objectStoreNames.contains(STORE)){const s=d.createObjectStore(STORE,{keyPath:"id"});s.createIndex("updatedAt","updatedAt");} };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
  const transact = (kind, action) => new Promise((resolve,reject) => {
    const tx=db.transaction(STORE,kind), store=tx.objectStore(STORE); let result;
    try { result=action(store); } catch(e){reject(e);return;}
    tx.oncomplete=()=>resolve(result); tx.onerror=()=>reject(tx.error);
  });
  const allEntries = () => new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.updatedAt-a.updatedAt));r.onerror=()=>reject(r.error);});
  const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const mdToHtml = md => {
    let s=escapeHTML(md||"").replace(/\r\n/g,"\n");
    s=s.replace(/^### (.+)$/gm,"<h3>$1</h3>").replace(/^## (.+)$/gm,"<h2>$1</h2>").replace(/^# (.+)$/gm,"<h1>$1</h1>");
    s=s.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/~~(.+?)~~/g,"<del>$1</del>").replace(/`(.+?)`/g,"<code>$1</code>");
    s=s.replace(/^&gt; (.+)$/gm,"<blockquote>$1</blockquote>");
    s=s.replace(/^(?:- |\* )(.+)$/gm,"<li>$1</li>").replace(/(<li>.*<\/li>\n?)+/g,m=>"<ul>"+m+"</ul>");
    return s.split(/\n{2,}/).map(p=>/^<(h[1-3]|ul|blockquote)/.test(p)?p:"<p>"+p.replace(/\n/g,"<br>")+"</p>").join("");
  };
  const htmlToMd = html => {
    const doc=new DOMParser().parseFromString(html||"","text/html");
    const walk=n=>{if(n.nodeType===3)return n.nodeValue; if(n.nodeType!==1)return "";let c=[...n.childNodes].map(walk).join("");switch(n.tagName){case "BR":return "\n";case "B":case "STRONG":return "**"+c+"**";case "I":case "EM":return "*"+c+"*";case "H1":return "# "+c+"\n\n";case "H2":return "## "+c+"\n\n";case "H3":return "### "+c+"\n\n";case "LI":return "- "+c+"\n";case "UL":case "OL":return c+"\n";case "BLOCKQUOTE":return "> "+c+"\n\n";case "P":return c+"\n\n";default:return c;}};
    return [...doc.body.childNodes].map(walk).join("").trim();
  };
  const plainText = html => {const d=new DOMParser().parseFromString(html||"","text/html");return d.body.textContent||"";};
  const wordCount = s => (s.trim().match(/\S+/g)||[]).length;
  const fmtDate = t => new Intl.DateTimeFormat(undefined,{day:"numeric",month:"short",year:"numeric"}).format(new Date(t));
  const showToast = msg => {const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2100);};
  const setSave = s => $("saveState").textContent=s;
  async function refresh(){entries=await allEntries();renderList();renderTimeline();renderConnections();populateInsightSelect();}
  function renderList(){
    const q=$("searchInput").value.toLowerCase();const visible=entries.filter(e=>(e.title+" "+plainText(e.content)+" "+(e.tags||[]).join(" ")).toLowerCase().includes(q));
    $("entryList").innerHTML=visible.map(e=>`<article class="entry-card ${e.id===currentId?"selected":""}" data-id="${e.id}"><h3>${escapeHTML(e.title||"Untitled entry")}</h3><p>${escapeHTML(plainText(e.content).slice(0,85)||"An empty page…")}</p><time>${fmtDate(e.updatedAt)}</time></article>`).join("");
    $("entryCount").textContent=`${entries.length} ${entries.length===1?"ENTRY":"ENTRIES"}`;$("emptyList").classList.toggle("hidden",entries.length>0);
    $("entryList").querySelectorAll("[data-id]").forEach(el=>el.addEventListener("click",()=>selectEntry(el.dataset.id)));
  }
  function updateCounts(){const content=mode==="rich"?plainText($("richEditor").innerHTML):$("markdownEditor").value;$("wordCount").textContent=`${wordCount(content)} WORDS`;}
  function getEditorContent(){return mode==="rich"?$("richEditor").innerHTML:mdToHtml($("markdownEditor").value);}
  function scheduleSave(){if(!currentId)return;setSave("Saving…");updateCounts();clearTimeout(saveTimer);saveTimer=setTimeout(saveCurrent,450);}
  async function saveCurrent(){
    if(!currentId)return;const e=entries.find(x=>x.id===currentId);if(!e)return;
    e.title=$("entryTitle").value.trim()||"Untitled entry";e.content=getEditorContent();e.tags=$("tagInput").value.split(",").map(x=>x.trim()).filter(Boolean);e.updatedAt=Date.now();
    await transact("readwrite",s=>s.put(e));setSave("All changes saved");renderList();
  }
  async function selectEntry(id){
    if(currentId)await saveCurrent();currentId=id;const e=entries.find(x=>x.id===id);if(!e)return;
    $("editorEmpty").classList.add("hidden");$("editorContent").classList.remove("hidden");
    $("entryTitle").value=e.title||"";$("richEditor").innerHTML=e.content||"";$("markdownEditor").value=htmlToMd(e.content||"");$("tagInput").value=(e.tags||[]).join(", ");
    $("entryDateLabel").textContent=fmtDate(e.createdAt).toUpperCase();setMode("rich");updateCounts();renderList();
    if(innerWidth<=680)$("editorPanel").scrollIntoView({behavior:"smooth",block:"start"});
  }
  async function createEntry(){
    if(currentId)await saveCurrent();const now=Date.now(),e={id:crypto.randomUUID(),title:"",content:"",tags:[],createdAt:now,updatedAt:now};
    await transact("readwrite",s=>s.put(e));await refresh();await selectEntry(e.id);$("entryTitle").focus();
  }
  function setMode(next){
    if(next===mode)return;
    if(mode==="rich")$("markdownEditor").value=htmlToMd($("richEditor").innerHTML);else $("richEditor").innerHTML=mdToHtml($("markdownEditor").value);
    mode=next;$("richEditor").classList.toggle("hidden",mode!=="rich");$("markdownEditor").classList.toggle("hidden",mode!=="markdown");
    document.querySelectorAll(".mode-btn").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));$("formatTools").classList.toggle("hidden",mode!=="rich");updateCounts();
  }
  function renderTimeline(){
    const groups={};entries.forEach(e=>{const k=new Date(e.createdAt).toLocaleDateString(undefined,{month:"long",year:"numeric"});(groups[k]??=[]).push(e);});
    $("timelineItems").innerHTML=Object.entries(groups).map(([month,items])=>`<div class="timeline-group"><div class="timeline-date">${escapeHTML(month)}</div>${items.map(e=>`<div class="timeline-entry" data-id="${e.id}"><strong>${escapeHTML(e.title||"Untitled entry")}</strong><small>${fmtDate(e.createdAt)} · ${wordCount(plainText(e.content))} words</small></div>`).join("")}</div>`).join("")||'<p class="muted">Your timeline will appear here as you write.</p>';
    $("timelineItems").querySelectorAll("[data-id]").forEach(x=>x.onclick=()=>{showView("journal");selectEntry(x.dataset.id);});
  }
  function renderConnections(){
    const map={};entries.forEach(e=>(e.tags||[]).forEach(t=>(map[t.toLowerCase()]??={label:t,items:[]}).items.push(e)));
    const groups=Object.values(map).filter(g=>g.items.length>1);
    $("connectionItems").innerHTML=groups.map(g=>`<div class="connection-row"><strong>#${escapeHTML(g.label)}</strong><small>${g.items.map(e=>escapeHTML(e.title||"Untitled entry")).join(" · ")}</small></div>`).join("")||'<p class="muted">Add the same tag to multiple entries to reveal connections between them.</p>';
  }
  function populateInsightSelect(){const old=$("insightEntry").value;$("insightEntry").innerHTML='<option value="">Choose an entry…</option>'+entries.map(e=>`<option value="${e.id}">${escapeHTML(e.title||"Untitled entry")}</option>`).join("");if(entries.some(e=>e.id===old))$("insightEntry").value=old;}
  function showView(name){
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$(name+"View").classList.add("active");
    document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
    $("sectionName").textContent=name.toUpperCase();$("sidebar").classList.remove("open");
  }
  function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
  async function exportJSON(){if(currentId)await saveCurrent();await refresh();download("aethelgard-backup.json",new Blob([JSON.stringify({format:"aethelgard-backup",version:1,exportedAt:new Date().toISOString(),entries},null,2)],{type:"application/json"}));showToast("Journal backup prepared.");}
  async function importJSON(file){try{const data=JSON.parse(await file.text());if(data.format!=="aethelgard-backup"||!Array.isArray(data.entries))throw Error();await transact("readwrite",s=>data.entries.forEach(e=>{if(e.id&&typeof e.content==="string")s.put(e);}));await refresh();showToast("Backup restored.");}catch{showToast("That backup file could not be read.");}}
  function applyTheme(name){const vals=themes[name]||themes.Obsidian;["bg","panel","panel2","line","text","muted","accent","accent-soft"].forEach((k,i)=>document.documentElement.style.setProperty("--"+k,vals[i]));localStorage.setItem("aethelgard-theme",name);}
  function setup(){
    $("todayDate").textContent=new Intl.DateTimeFormat(undefined,{weekday:"long",day:"numeric",month:"long"}).format(new Date());
    $("themeSelect").innerHTML=Object.keys(themes).map(t=>`<option>${t}</option>`).join("");const saved=localStorage.getItem("aethelgard-theme")||"Obsidian";$("themeSelect").value=saved;applyTheme(saved);
    $("newEntryBtn").onclick=$("firstEntryBtn").onclick=createEntry;$("searchInput").oninput=renderList;
    ["entryTitle","tagInput"].forEach(id=>$(id).addEventListener("input",scheduleSave));
    $("richEditor").addEventListener("input",scheduleSave);$("markdownEditor").addEventListener("input",scheduleSave);
    document.querySelectorAll(".mode-btn").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
    document.querySelectorAll(".format-tools button").forEach(b=>b.onclick=()=>{const cmd=b.dataset.command;if(cmd==="formatBlock")document.execCommand(cmd,false,b.dataset.value);else if(cmd==="blockquote")document.execCommand("formatBlock",false,"blockquote");else document.execCommand(cmd,false,null);$("richEditor").focus();scheduleSave();});
    document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
    $("mobileMenuBtn").onclick=()=>$("sidebar").classList.toggle("open");
    $("exportBtn").onclick=exportJSON;$("backupBtn").onclick=exportJSON;$("importBtn").onclick=()=>$("importFile").click();$("importFile").onchange=e=>e.target.files[0]&&importJSON(e.target.files[0]);
    $("themeSelect").onchange=e=>applyTheme(e.target.value);
    $("deleteEntryBtn").onclick=async()=>{if(!currentId)return;if(!confirm("Delete this entry permanently from this device?"))return;await transact("readwrite",s=>s.delete(currentId));currentId=null;$("editorContent").classList.add("hidden");$("editorEmpty").classList.remove("hidden");await refresh();showToast("Entry deleted.");};
    $("analyzeBtn").onclick=()=>{const e=entries.find(x=>x.id===$("insightEntry").value);if(!e){showToast("Choose an entry first.");return;}const body=plainText(e.content);$("insightResult").innerHTML=`<h3>${escapeHTML(e.title||"Untitled entry")}</h3><p><b>Pause and examine:</b></p><ol><li>What is the central claim or concern in this entry?</li><li>Which parts are observable facts, and which are interpretations?</li><li>What assumption might be influencing your conclusion?</li><li>Is there a tension between this entry and something you have written before?</li><li>What would a more measured response look like?</li></ol><p class="muted">This is a guided reflection, not an automated psychological assessment. Your text was not sent anywhere.</p>`;};
    document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="s"){e.preventDefault();saveCurrent();}});
  }
  // A small, explicit bridge used by the encrypted Google Drive module.
  // The cloud module receives entry objects only; it never receives the DB handle.
  let activeContext = "guest";
  async function accountDatabaseName(email) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) throw new Error("A verified Google account email is required.");
    const bytes = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const suffix = [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,32);
    return "aethelgard-account-" + suffix;
  }
  async function switchDatabase(name, context) {
    if (currentId) await saveCurrent();
    if (db) db.close();
    db = await openDB(name);
    activeContext = context;
    currentId = null;
    $("editorContent").classList.add("hidden");
    $("editorEmpty").classList.remove("hidden");
    await refresh();
  }
  window.AethelgardData = {
    getContext: () => activeContext,
    activateAccount: async email => {
      if (currentId) await saveCurrent();
      const guestEntries = activeContext === "guest" ? await allEntries() : [];
      const dbName = await accountDatabaseName(email);
      await switchDatabase(dbName, "account:" + String(email).trim().toLowerCase());
      return guestEntries;
    },
    importGuestEntries: async guestEntries => {
      if (activeContext === "guest") throw new Error("Switch to a Google account before importing guest entries.");
      if (!Array.isArray(guestEntries)) throw new Error("Invalid guest journal data.");
      return await window.AethelgardData.mergeEntries(guestEntries);
    },
    getEntries: async () => { if(currentId) await saveCurrent(); return await allEntries(); },
    replaceEntries: async incoming => {
      if(!Array.isArray(incoming)) throw new Error("Invalid journal data");
      await transact("readwrite", store => {
        const clear = store.clear();
        clear.onsuccess = () => incoming.forEach(entry => { if(entry && typeof entry.id === "string" && typeof entry.content === "string") store.put(entry); });
      });
      currentId=null; $("editorContent").classList.add("hidden"); $("editorEmpty").classList.remove("hidden"); await refresh();
    },
    mergeEntries: async remoteEntries => {
      const local = await allEntries(); const merged = new Map(local.map(e=>[e.id,e]));
      for(const remote of remoteEntries){ const existing=merged.get(remote.id); if(!existing || (remote.updatedAt||0)>(existing.updatedAt||0)) merged.set(remote.id,remote); }
      const result=[...merged.values()]; await transact("readwrite",store=>{store.clear().onsuccess=()=>result.forEach(e=>store.put(e));});
      currentId=null; $("editorContent").classList.add("hidden"); $("editorEmpty").classList.remove("hidden"); await refresh(); return result;
    }
  };
  (async()=>{try{db=await openDB();setup();await refresh();if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});}catch(e){console.error(e);showToast("Local storage is unavailable in this browser.");}})();
})();