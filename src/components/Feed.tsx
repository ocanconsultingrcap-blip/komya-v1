import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import { callFn } from '../lib/functions';
import PostCard from './PostCard';
import PostComposer from './PostComposer';
import type { Post } from './PostCard';

const PAGE = 20;

export default function Feed({ userId, staff = false }: { userId: string; staff?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(true);

  const load = useCallback(async (offset: number) => {
    setLoading(true);
    const { data, error: err } = await supabase.from('posts')
      .select('id,body,created_at,author_id,category,pinned,profiles!posts_author_id_fkey(display_name,avatar_url)')
      .is('deleted_at', null).is('network_id', null).order('pinned', { ascending: false }).order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
    setLoading(false);
    if (err) { setError(frError(err)); return; }
    const rows = (data ?? []) as unknown as Post[];
    setPosts(prev => (offset === 0 ? rows : [...prev, ...rows]));
    setMore(rows.length === PAGE);
  }, []);
  useEffect(() => { void load(0); }, [load]);

  async function remove(id: string) {
    const msg = await callFn('delete-post', { post_id: id });
    if (msg) setError(msg); else setPosts(p => p.filter(x => x.id !== id));
  }

  return (
    <>
      <section className="hero">
        <small>VOTRE ESPACE ENTREPRENEURIAL</small>
        <h1>Les bonnes connexions font avancer les projets.</h1>
      </section>
      <PostComposer userId={userId} networkId={null} onPosted={() => void load(0)} />
      {error && <p className="error" role="alert">{error}</p>}
      {posts.map(p => <PostCard key={p.id} post={p} userId={userId} canModerate={staff} onDelete={id => void remove(id)} />)}
      {!loading && posts.length === 0 && !error && <p>Aucune publication pour le moment. Lance la conversation : partage ton activité ou pose une question.</p>}
      {loading && <p>Chargement…</p>}
      {more && !loading && posts.length > 0 && <button className="secondary" onClick={() => void load(posts.length)}>Voir plus</button>}
    </>
  );
}
