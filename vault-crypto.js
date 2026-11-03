/* Aethelgard client-side vault encryption. Passphrases are never persisted. */
(() => {
  const ITERATIONS = 310000;
  const AAD = new TextEncoder().encode("Aethelgard encrypted journal vault v1");
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const toB64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const fromB64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  async function derive(passphrase, salt) {
    const material = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:ITERATIONS,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  }
  async function encrypt(payload, passphrase) {
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const key=await derive(passphrase,salt);
    const plaintext=enc.encode(JSON.stringify(payload));
    const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:AAD},key,plaintext);
    return {format:"aethelgard-encrypted-vault",version:1,kdf:"PBKDF2-SHA-256",iterations:ITERATIONS,cipher:"AES-256-GCM",salt:toB64(salt),iv:toB64(iv),ciphertext:toB64(ciphertext),updatedAt:new Date().toISOString()};
  }
  async function decrypt(envelope, passphrase) {
    if(!envelope || envelope.format!=="aethelgard-encrypted-vault" || envelope.version!==1) throw new Error("This is not a supported Aethelgard vault.");
    const key=await derive(passphrase,fromB64(envelope.salt));
    const plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(envelope.iv),additionalData:AAD},key,fromB64(envelope.ciphertext));
    const payload=JSON.parse(dec.decode(plaintext));
    if(!payload || payload.format!=="aethelgard-journal" || !Array.isArray(payload.entries)) throw new Error("The decrypted vault has an invalid structure.");
    return payload;
  }
  window.AethelgardCrypto={encrypt,decrypt};
})();
