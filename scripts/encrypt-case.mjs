// Encrypts a private case study so it can live in this PUBLIC repo.
//
//   node scripts/encrypt-case.mjs <plain.html> <public/encrypted/name.json>
//
// Asks for the password without echoing it. The output is AES-256-GCM
// ciphertext with a PBKDF2-SHA256 key (600k iterations); without the password
// it is unreadable, so it is safe to commit. The plaintext must never be
// committed. Keep it outside the repo (Karen's copy is in Career Goals).
// The browser side is src/components/EncryptedCase.astro.
import fs from 'node:fs';
import readline from 'node:readline';
import { webcrypto as crypto } from 'node:crypto';

const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: node scripts/encrypt-case.mjs <plain.html> <out.json>'); process.exit(1); }

function ask(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}

const pw = await ask('Password: ');
const again = await ask('Again: ');
if (!pw || pw !== again) { console.error('Passwords did not match.'); process.exit(1); }
if (pw.length < 10) { console.error('Use at least 10 characters; the ciphertext is public.'); process.exit(1); }

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
  base, { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
);
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(fs.readFileSync(src, 'utf8')));
const b64 = (u) => Buffer.from(u).toString('base64');
fs.writeFileSync(out, JSON.stringify({ v: 1, iterations: 600000, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) }));
console.log(`Encrypted ${src} -> ${out}`);
