import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import ReportButton from './ReportButton';
import Attachments from './Attachments';
import Avatar from './Avatar';

export type Post = { id: string; category?: string; body: string; created_at: string; author_id: string; profiles: { display_name: string; avatar_url?: string | null } | null };
type Comment = { id: string; body: string; created_at: string; author_id: string; profiles: { display_name: string } | null };
type Reaction = { user_id: string; reaction: string };
const REACTIONS: [string, string][] = [['like', '❤️ J’aime'], ['bravo', '👏 Bravo'], ['idea', '💡 Inspirant'], ['support', '🤝 Soutien']];

export default function PostCard({ post, userId, onDelete, canModerate = false }: { post: Post; userId: string; onDelete: (id: string) => void; canModerate?: boolean }) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  async function loadReactions() {
    const { data, error: err } = await supabase.from('reactions').select('user_id,reaction').eq('post_id', post.id);
    if (err) setError(frError(err)); else setReactions((data ?? []) as Reaction[]);
  }
  async function loadComments() {
    const { data, error: err } = await supabase.from('comments').select('id,body,created_at,author_id,profiles(display_name)')
      .eq('post_id', post.id).is('deleted_at', null).order('created_at').limit(100);
    if (err) setError(frError(err)); else setComments((data ?? []) as unknown as Comment[]);
  }
  useEffect(() => { void loadReactions(); }, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function react(kind: string) {
    setError('');
    const mine = reactions.find(r => r.user_id === userId);
    if (mine) {
      const { error: err } = await supabase.from('reactions').delete().eq('post_id', post.id).eq('user_id', userId);
      if (err) { setError(frError(err)); return; }
    }
    if (!mine || mine.reaction !== kind) {
      const { error: err } = await supabase.from('reactions').insert({ post_id: post.id, user_id: userId, reaction: kind });
      if (err) { setError(frError(err)); }
    }
    void loadReactions();
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    const { error: err } = await supabase.from('comments').insert({ post_id: post.id, author_id: userId, body: draft.trim() });
    if (err) setError(frError(err)); else { setDraft(''); void loadComments(); }
  }
  async function removeComment(id: string) {
    const { error: err } = await supabase.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (err) setError(frError(err)); else setComments(c => (c ?? []).filter(x => x.id !== id));
  }

  const mine = reactions.find(r => r.user_id === userId)?.reaction;
  return (
    <article className="card">
      <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}><Avatar name={post.profiles?.display_name ?? 'M'} url={post.profiles?.avatar_url} size={36} /><b>{post.profiles?.display_name ?? 'Membre KOMYA'}</b></p> {post.category && <small>{post.category}</small>}
      <p style={{ whiteSpace: 'pre-wrap' }}>{post.body}</p>
      <Attachments postId={post.id} />
      <small>{new Date(post.created_at).toLocaleString('fr-FR')}</small>
      <div className="row">
        {REACTIONS.map(([k, label]) => (
          <button key={k} className={mine === k ? '' : 'secondary'} onClick={() => void react(k)}>
            {label} {reactions.filter(r => r.reaction === k).length || ''}
          </button>
        ))}
        <button className="secondary" onClick={() => (comments ? setComments(null) : void loadComments())}>Commentaires</button>
        {(post.author_id === userId || canModerate)
          ? <button className="secondary" onClick={() => onDelete(post.id)}>Supprimer</button>
          : <ReportButton userId={userId} targetType="post" targetId={post.id} />}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {comments && (
        <div className="comments">
          {comments.length === 0 && <small>Aucun commentaire.</small>}
          {comments.map(c => (
            <p key={c.id}>
              <b>{c.profiles?.display_name ?? 'Membre KOMYA'}</b> : {c.body}{' '}
              {c.author_id === userId
                ? <button className="secondary" onClick={() => void removeComment(c.id)}>Supprimer</button>
                : <ReportButton userId={userId} targetType="comment" targetId={c.id} />}
            </p>
          ))}
          <form onSubmit={e => void addComment(e)}>
            <input aria-label="Votre commentaire" placeholder="Votre commentaire" maxLength={2000} value={draft} onChange={e => setDraft(e.target.value)} />
            <button disabled={!draft.trim()}>Commenter</button>
          </form>
        </div>
      )}
    </article>
  );
}
