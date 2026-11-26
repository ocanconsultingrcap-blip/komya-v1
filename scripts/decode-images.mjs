// Icônes PWA : déjà générées et commitées dans public/.
// Si le dossier assets-base64/ existe, régénère les images ; sinon, rien à faire.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

if (!existsSync('assets-base64')) {
  console.log('assets-base64/ absent : icônes déjà présentes dans public/, rien à faire.');
  process.exit(0);
}
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
