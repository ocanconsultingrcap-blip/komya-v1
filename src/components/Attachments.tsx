import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import { prettySize } from '../lib/image';

type Att = { id: string; kind: 'image' | 'file' | 'link'; path: string | null; url: string | null; name: string | null; size_bytes: number | null };

export default function Attachments({ postId }: { postId: string }) {
  const [atts, setAtts] = useState<Att[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('post_attachments').select('id,kind,path,url,name,size_bytes').eq('post_id', postId).order('created_at');
      const list = (data ?? []) as Att[];
      setAtts(list);
      const imgs = list.filter(a => a.kind === 'image' && a.path);
      if (imgs.length) {
        const { data: signed } = await supabase.storage.from('post-media').createSignedUrls(imgs.map(a => a.path as string), 3600);
        const map: Record<string, string> = {};
        (signed ?? []).forEach((s, i) => { if (s.signedUrl) map[imgs[i].id] = s.signedUrl; });
        setUrls(map);
      }
    })();
  }, [postId]);

  async function open(a: Att) {
    if (!a.path) return;
    const { data, error: err } = await supabase.storage.from('post-media').createSignedUrl(a.path, 120);
    if (err || !data) setError(frError(err)); else window.open(data.signedUrl, '_blank', 'noopener');
  }
  if (atts.length === 0) return null;
  const host = (u: string) => { try { return new URL(u).hostname; } catch { return u; } };
  return (
    <div>
      {atts.filter(a => a.kind === 'image').map(a => urls[a.id] && <img key={a.id} src={urls[a.id]} alt={a.name ?? 'Photo'} loading="lazy" style={{ maxWidth: '100%', borderRadius: 10, margin: '6px 0', display: 'block' }} />)}
      {atts.filter(a => a.kind === 'file').map(a => <p key={a.id}><button className="secondary" onClick={() => void open(a)}>📎 {a.name} <small>({prettySize(a.size_bytes ?? 0)})</small></button></p>)}
      {atts.filter(a => a.kind === 'link').map(a => a.url && <p key={a.id}>🔗 <a href={a.url} target="_blank" rel="noopener noreferrer nofollow">{host(a.url)}</a></p>)}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
