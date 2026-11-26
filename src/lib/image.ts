export const MAX_FILE = 1572864; // 1,5 Mo
export const MAX_POST = 3000;
export const MAX_FILES = 4;
export const MAX_LINKS = 3;
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
export const extOf = (n: string) => (n.split('.').pop() ?? '').toLowerCase();
export const mimeOf = (n: string) => MIME[extOf(n)];
export const prettySize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Cette image ne peut pas être lue. Utilise une photo JPG ou PNG.')); };
    img.src = url;
  });
}
const toBlob = (c: HTMLCanvasElement, q: number): Promise<Blob | null> => new Promise(r => c.toBlob(r, 'image/jpeg', q));

// Réduit automatiquement la photo (faible résolution) pour limiter le stockage.
export async function compressImage(file: File): Promise<File> {
  const img = await loadImage(file);
  let maxDim = 1280, q = 0.72;
  for (let i = 0; i < 5; i++) {
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cette image ne peut pas être traitée sur ton appareil.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    const blob = await toBlob(canvas, q);
    if (blob && blob.size <= MAX_FILE) return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    maxDim = Math.round(maxDim * 0.75); q = Math.max(0.4, q - 0.1);
  }
  throw new Error('Cette image est trop lourde même après réduction. Choisis-en une autre.');
}

// Photo de profil : carré recadré au centre, 512 px, léger.
export async function compressAvatar(file: File): Promise<File> {
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = Math.round((img.naturalWidth - side) / 2), sy = Math.round((img.naturalHeight - side) / 2);
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cette image ne peut pas être traitée sur ton appareil.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 512, 512); ctx.drawImage(img, sx, sy, side, side, 0, 0, 512, 512);
  const blob = await toBlob(canvas, 0.8);
  if (!blob) throw new Error('Cette image ne peut pas être traitée sur ton appareil.');
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

export const compressSquare = compressAvatar;
