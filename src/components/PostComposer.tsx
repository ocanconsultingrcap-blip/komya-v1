import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import { callFn } from '../lib/functions';
import { MAX_FILE, MAX_FILES, MAX_LINKS, MAX_POST, compressImage, extOf, mimeOf, prettySize } from '../lib/image';
import { POST_CATS } from '../lib/format';

const FILE_EXTS = ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv'];

export default function PostComposer({ userId, networkId, onPosted }: { userId: string; networkId: string | null; onPosted: () => void }) {
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState(POST_CATS[0]);
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addPhotos(list: FileList | null) {
    if (!list) return;
    setError('');
    for (const f of Array.from(list)) {
      if (files.length >= MAX_FILES) { setError(`${MAX_FILES} fichiers au maximum par publication.`); break; }
      if (!f.type.startsWith('image/')) { setError('Choisis une photo (JPG, PNG ou WebP).'); continue; }
      try { const small = await compressImage(f); setFiles(prev => (prev.length < MAX_FILES ? [...prev, small] : prev)); }
      catch (e) { setError(frError(e)); }
    }
    if (photoRef.current) photoRef.current.value = '';
  }
  function addFiles(list: FileList | null) {
    if (!list) return;
    setError('');
    for (const f of Array.from(list)) {
      if (files.length >= MAX_FILES) { setError(`${MAX_FILES} fichiers au maximum par publication.`); break; }
      if (!FILE_EXTS.includes(extOf(f.name))) { setError('Formats acceptés : PDF, Word, Excel, PowerPoint, TXT, CSV.'); continue; }
      if (f.size > MAX_FILE) { setError(`« ${f.name} » est trop lourd (${prettySize(f.size)}) : 1,5 Mo maximum par fichier.`); continue; }
      setFiles(prev => (prev.length < MAX_FILES ? [...prev, f] : prev));
    }
    if (fileRef.current) fileRef.current.value = '';
  }
  function addLink() {
    const u = linkInput.trim();
    if (!u) return;
    if (!/^https?:\/\/\S+$/i.test(u)) { setError('Le lien doit commencer par http:// ou https://'); return; }
    if (links.length >= MAX_LINKS) { setError(`${MAX_LINKS} liens au maximum par publication.`); return; }
    setLinks([...links, u]); setLinkInput(''); setError('');
  }

  async function publish(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || body.length > MAX_POST || busy) return;
    setBusy(true); setError(''); setNotice('');
    const { data, error: err } = await supabase.from('posts').insert({ body, author_id: userId, category, network_id: networkId }).select('id').single();
    if (err || !data) { setBusy(false); setError(frError(err)); return; }
    const postId = data.id as string;
    const problems: string[] = [];
    for (const f of files) {
      const path = `${userId}/${postId}/${Math.random().toString(36).slice(2, 8)}-${f.name.replace(/[^\w.-]/g, '_')}`;
      const up = await supabase.storage.from('post-media').upload(path, f, { contentType: mimeOf(f.name) ?? f.type });
      if (up.error) { problems.push(`${f.name} : ${frError(up.error)}`); continue; }
      const msg = await callFn('finalize-attachment', { post_id: postId, path, name: f.name });
      if (msg) problems.push(`${f.name} : ${msg}`);
    }
    for (const l of links) {
      const { error: lerr } = await supabase.rpc('komya_add_post_link', { pid: postId, u: l });
      if (lerr) problems.push(`${l} : ${frError(lerr)}`);
    }
    setBusy(false);
    setDraft(''); setFiles([]); setLinks([]);
    if (problems.length) setNotice(`Publication envoyée, mais certaines pièces jointes ont été refusées : ${problems.join(' ; ')}`);
    onPosted();
  }

  const left = MAX_POST - draft.length;
  return (
    <>
      <form className="card" onSubmit={e => void publish(e)}>
        <textarea aria-label="Nouvelle publication" placeholder="Que souhaitez-vous partager ?" value={draft} maxLength={MAX_POST} onChange={e => setDraft(e.target.value)} />
        <small role="status" style={{ color: left < 200 ? '#c0392b' : undefined }}>{draft.length} / 3 000 caractères</small>
        <select aria-label="Catégorie" value={category} onChange={e => setCategory(e.target.value)}>{POST_CATS.map(c => <option key={c}>{c}</option>)}</select>
        <div className="row">
          <label className="filebtn">📷 Photo<input ref={photoRef} className="sr" type="file" accept="image/*" multiple onChange={e => void addPhotos(e.target.files)} /></label>
          <label className="filebtn">📎 Fichier<input ref={fileRef} className="sr" type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv" multiple onChange={e => addFiles(e.target.files)} /></label>
        </div>
        <small>Les photos sont réduites automatiquement. Fichiers : 1,5 Mo maximum chacun, {MAX_FILES} au maximum. Les vidéos ne sont pas acceptées.</small>
        <div className="row">
          <input aria-label="Lien" placeholder="Ajouter un lien (https://…)" value={linkInput} onChange={e => setLinkInput(e.target.value)} />
          <button type="button" className="secondary" onClick={addLink}>Ajouter</button>
        </div>
        {files.map((f, i) => <p key={i}>{f.type.startsWith('image/') ? '🖼️' : '📎'} {f.name} <small>({prettySize(f.size)})</small> <button type="button" className="secondary" onClick={() => setFiles(files.filter((_, j) => j !== i))}>Retirer</button></p>)}
        {links.map((l, i) => <p key={l}>🔗 {l} <button type="button" className="secondary" onClick={() => setLinks(links.filter((_, j) => j !== i))}>Retirer</button></p>)}
        <button disabled={!draft.trim() || busy}>{busy ? 'Publication en cours…' : 'Publier'}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </>
  );
}
