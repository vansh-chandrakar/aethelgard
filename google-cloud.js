/* Google Drive connection + encrypted vault sync. OAuth tokens stay in memory only. */
(() => {
  const $=id=>document.getElementById(id);
  const FOLDER_NAME="Aethelgard";
  const VAULT_NAME="aethelgard-vault.json";
  const FOLDER_MIME="application/vnd.google-apps.folder";
  const SCOPE="openid email https://www.googleapis.com/auth/drive.file";
  let tokenClient=null, accessToken=null, accountEmail="", folderId=null, vaultFileId=null, vaultUnlocked=false;
  const stateKey=()=> "aethelgard-drive-state-v1:" + encodeURIComponent(String(accountEmail||"").toLowerCase());
  const readState=()=>{try{return JSON.parse(localStorage.getItem(stateKey())||"{}");}catch{return {}; }};
  const saveState=()=>localStorage.setItem(stateKey(),JSON.stringify({folderId,vaultFileId}));
  const status=(message,connected=false)=>{const el=$("cloudStatus");el.innerHTML=`<span class="status-dot ${connected?"connected":""}"></span><span>${escapeText(message)}</span>`;};
  const escapeText=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast=message=>{const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);};
  const apiError=async response=>{let detail="";try{const body=await response.json();detail=body.error?.message||"";}catch{};throw new Error(detail||`Google Drive request failed (${response.status}).`);};
  async function drive(path,options={}){
    if(!accessToken)throw new Error("Connect Google Drive first.");
    const response=await fetch(`https://www.googleapis.com/drive/v3/${path}`,{...options,headers:{Authorization:`Bearer ${accessToken}`,...(options.headers||{})}});
    if(!response.ok)await apiError(response);return response;
  }
  async function listFiles(query){const params=new URLSearchParams({q:query,fields:"files(id,name,mimeType,modifiedTime)",pageSize:"100",spaces:"drive"});const r=await drive(`files?${params}`);return (await r.json()).files||[];}
  async function ensureFolder(){
    const matches=await listFiles(`name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`);
    if(matches.length){folderId=matches[0].id;}else{
      const r=await drive("files",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:FOLDER_NAME,mimeType:FOLDER_MIME})});folderId=(await r.json()).id;
    }
    const files=await listFiles(`'${folderId}' in parents and name='${VAULT_NAME}' and trashed=false`);
    vaultFileId=files[0]?.id||null;saveState();
  }
  async function getVault(){
    if(!vaultFileId)return null;
    const r=await drive(`files/${encodeURIComponent(vaultFileId)}?alt=media`);
    return await r.json();
  }
  async function putVault(envelope){
    const boundary="aethelgard_"+crypto.randomUUID().replaceAll("-","");
    const metadata=JSON.stringify(vaultFileId?{name:VAULT_NAME}:{name:VAULT_NAME,mimeType:"application/json",parents:[folderId]});
    const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(envelope)}\r\n--${boundary}--`;
    const endpoint=vaultFileId?`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(vaultFileId)}?uploadType=multipart`:`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    const response=await fetch(endpoint,{method:vaultFileId?"PATCH":"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":`multipart/related; boundary=${boundary}`},body});
    if(!response.ok)await apiError(response);const file=await response.json();vaultFileId=file.id;saveState();
  }
  function getToken(){
    return new Promise((resolve,reject)=>{
      if(!window.google?.accounts?.oauth2){reject(new Error("Google's sign-in library has not loaded. Check your internet connection and reload."));return;}
      if(!tokenClient)tokenClient=google.accounts.oauth2.initTokenClient({client_id:window.AETHELGARD_CONFIG?.GOOGLE_CLIENT_ID||"",scope:SCOPE,callback:response=>{if(response.error){reject(new Error(response.error_description||response.error));return;}accessToken=response.access_token;resolve(accessToken);}});
      tokenClient.requestAccessToken({prompt:"select_account"});
    });
  }
  async function connect(){
    const clientId=window.AETHELGARD_CONFIG?.GOOGLE_CLIENT_ID||"";
    if(!clientId||clientId.includes("PASTE_YOUR")){toast("Add your Google OAuth Client ID in config.js first.");return;}
    try{
      status("Waiting for Google authorization…");await getToken();
      const profile=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:`Bearer ${accessToken}`}});
      if(!profile.ok)throw new Error("Could not read the Google account profile.");
      const user=await profile.json();
      if(!user.email)throw new Error("Google did not provide an account email.");
      const previousEmail=accountEmail;
      accountEmail=user.email.toLowerCase();
      const saved=readState();folderId=saved.folderId||null;vaultFileId=saved.vaultFileId||null;
      vaultUnlocked=false;$("syncNowBtn").disabled=true;
      const guestEntries=await AethelgardData.activateAccount(accountEmail);
      await ensureFolder();
      status(`Connected as ${accountEmail}`,true);
      if(guestEntries.length){
        const transfer=confirm(`You have ${guestEntries.length} guest journal entr${guestEntries.length===1?"y":"ies"} on this device. Transfer them into ${accountEmail}'s encrypted vault?\n\nChoose Cancel to keep them separate in Guest Mode.`);
        if(transfer){
          // Keep the guest database intact; only copy its entries into the signed-in account database.
          await AethelgardData.importGuestEntries(guestEntries);
          toast("Guest entries copied into this account. Unlock or create your vault to sync them.");
        }else{
          toast("Guest entries remain separate. Your Google account has its own journal.");
        }
      }else{
        toast(previousEmail && previousEmail!==accountEmail ? "Switched accounts. Each account has separate local journal storage." : "Google Drive connected. Set up or unlock your vault next.");
      }
      $("syncNowBtn").disabled=true;
    }catch(error){console.error(error);status("Not connected");toast(error.message||"Google connection failed.");}
  }
  async function unlockOrCreate(){
    if(!accessToken){toast("Connect Google Drive first.");return;}
    const pass=$ ("vaultPassphrase").value;
    const confirm=$("vaultPassphraseConfirm").value;
    if(pass.length<10){toast("Use a passphrase with at least 10 characters.");return;}
    try{
      await ensureFolder();const remote=await getVault();
      if(remote){
        const payload=await AethelgardCrypto.decrypt(remote,pass);
        const local=await AethelgardData.getEntries();
        const merged=await AethelgardData.mergeEntries(payload.entries);
        // Merge local entries too, preserving the newest version for each entry ID.
        const finalEntries=await AethelgardData.mergeEntries(local);
        const envelope=await AethelgardCrypto.encrypt({format:"aethelgard-journal",version:1,entries:finalEntries},pass);
        await putVault(envelope);
        toast("Vault unlocked and journal synchronized.");
      }else{
        if(pass!==confirm){toast("The passphrases do not match.");return;}
        const entries=await AethelgardData.getEntries();
        const envelope=await AethelgardCrypto.encrypt({format:"aethelgard-journal",version:1,entries},pass);
        await putVault(envelope);toast("Encrypted vault created in your Google Drive.");
      }
      vaultUnlocked=true;$("syncNowBtn").disabled=false;$("vaultPassphrase").value="";$("vaultPassphraseConfirm").value="";
      $("vaultHelp").textContent="Vault unlocked for this browser session. Keep your passphrase safe; Aethelgard cannot reset it.";
      status(`Vault ready · ${accountEmail}`,true);
    }catch(error){console.error(error);toast(error.name==="OperationError"?"That passphrase did not unlock this vault.":error.message||"Could not unlock vault.");}
  }
  async function syncNow(){
    if(!accessToken){toast("Reconnect Google Drive to continue.");return;}
    if(!vaultUnlocked){toast("Unlock your vault first.");return;}
    const pass=$ ("vaultPassphrase").value;
    if(pass.length<10){toast("Enter your vault passphrase (at least 10 characters).");return;}
    try{
      const remote=await getVault();let merged=await AethelgardData.getEntries();
      if(remote){const payload=await AethelgardCrypto.decrypt(remote,pass);merged=await AethelgardData.mergeEntries(payload.entries);}
      const envelope=await AethelgardCrypto.encrypt({format:"aethelgard-journal",version:1,entries:merged},pass);
      await putVault(envelope);toast("Encrypted journal synchronized.");
    }catch(error){console.error(error);toast(error.name==="OperationError"?"Incorrect vault passphrase.":error.message||"Sync failed.");}
    finally{$("vaultPassphrase").value="";}
  }
  function init(){
    $("googleConnectBtn").addEventListener("click",connect);
    $("vaultSetupBtn").addEventListener("click",unlockOrCreate);
    $("syncNowBtn").addEventListener("click",syncNow);
    status("Not connected");
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
