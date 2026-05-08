const subtle = globalThis.crypto.subtle;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const buf = new ArrayBuffer(s.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out as Uint8Array<ArrayBuffer>;
}

export async function generateInstallKey(): Promise<string> {
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = await subtle.exportKey('raw', key);
  return toBase64(new Uint8Array(raw));
}

async function importKey(rawB64: string): Promise<CryptoKey> {
  return subtle.importKey('raw', fromBase64(rawB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptString(plaintext: string, rawKeyB64: string): Promise<string> {
  const key = await importKey(rawKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  const both = new Uint8Array(iv.length + ciphertext.byteLength);
  both.set(iv, 0);
  both.set(new Uint8Array(ciphertext), iv.length);
  return toBase64(both);
}

export async function decryptString(cipherB64: string, rawKeyB64: string): Promise<string> {
  const key = await importKey(rawKeyB64);
  const data = fromBase64(cipherB64);
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}
