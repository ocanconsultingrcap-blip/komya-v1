// Recrée les 4 images PNG de public/ à partir des fichiers texte base64.
// Usage : node scripts/decode-images.mjs   (les fichiers .b64.txt sont dans assets-base64/)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const cibles = {
  'favicon': 'public/favicon.png',
  'icon-192': 'public/icons/icon-192.png',
  'icon-512': 'public/icons/icon-512.png',
  'icon-maskable-512': 'public/icons/icon-maskable-512.png',
};
mkdirSync('public/icons', { recursive: true });
for (const [nom, sortie] of Object.entries(cibles)) {
  const b64 = readFileSync(`assets-base64/${nom}.b64.txt`, 'utf8').trim();
  writeFileSync(sortie, Buffer.from(b64, 'base64'));
  console.log('OK', sortie);
}
