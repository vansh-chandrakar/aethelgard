/* Aethelgard client-side vault encryption. Passphrases are never persisted. */
(() => {
  const ITERATIONS = 310000;
  const AAD = new TextEncoder().encode("Aethelgard encrypted journal vault v1");
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const toB64 = bytes => {
    const data = new Uint8Array(bytes);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < data.length; i += chunkSize) {
      binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  };
  const fromB64 = value => {
    if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
      throw new Error("The encrypted vault contains invalid encoded data.");
    }
    const binary = atob(value);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
  };
  async function derive(passphrase, salt) {
    const material = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:ITERATIONS,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  }
  async function encrypt(payload, passphrase) {
    if (typeof passphrase !== "string" || passphrase.length < 10) {
      throw new Error("Use a vault passphrase with at least 10 characters.");
    }
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const key=await derive(passphrase,salt);
    const plaintext=enc.encode(JSON.stringify(payload));
    const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:AAD},key,plaintext);
    return {format:"aethelgard-encrypted-vault",version:1,kdf:"PBKDF2-SHA-256",iterations:ITERATIONS,cipher:"AES-256-GCM",salt:toB64(salt),iv:toB64(iv),ciphertext:toB64(ciphertext),updatedAt:new Date().toISOString()};
  }
  async function decrypt(envelope, passphrase) {
    if (!envelope || envelope.format !== "aethelgard-encrypted-vault" || envelope.version !== 1 ||
        envelope.kdf !== "PBKDF2-SHA-256" || envelope.iterations !== ITERATIONS ||
        envelope.cipher !== "AES-256-GCM") {
      throw new Error("This is not a supported Aethelgard vault format.");
    }
    if (typeof passphrase !== "string" || passphrase.length < 10) {
      throw new Error("Enter the vault passphrase used when this vault was created.");
    }
    const salt=fromB64(envelope.salt), iv=fromB64(envelope.iv), ciphertext=fromB64(envelope.ciphertext);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) {
      throw new Error("The encrypted vault appears to be damaged.");
    }
    const key=await derive(passphrase,salt);
    const plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:AAD},key,ciphertext);
    const payload=JSON.parse(dec.decode(plaintext));
    if(!payload || payload.format!=="aethelgard-journal" || !Array.isArray(payload.entries)) throw new Error("The decrypted vault has an invalid structure.");
    return payload;
  }
  window.AethelgardCrypto={encrypt,decrypt};
})();
