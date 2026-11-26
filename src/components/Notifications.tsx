import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';

type N = { id: string; title: string; body: string | null; kind: string; created_at: string; read_at: string | null };

export default function Notifications({ userId, onChange }: { userId: string; onChange: () => void }) {
  const [list, setList] = useState<N[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('notifications').select('id,title,body,kind,created_at,read_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (err) setError(frError(err)); else setList((data ?? []) as N[]);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  async function markRead(id?: string) {
    let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
    if (id) q = q.eq('id', id);
    const { error: err } = await q;
    if (err) setError(frError(err)); else { void load(); onChange(); }
  }

  return (
    <>
      <h2>Notifications</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {list.some(n => !n.read_at) && <button className="secondary" onClick={() => void markRead()}>Tout marquer comme lu</button>}
      {list.length === 0 && <p>Aucune notification.</p>}
      {list.map(n => (
        <div className="card" key={n.id} style={n.read_at ? { opacity: 0.6 } : undefined}>
          <b>{n.title}</b>
          {n.body && <p>{n.body}</p>}
          <small>{new Date(n.created_at).toLocaleString('fr-FR')}</small>{' '}
          {!n.read_at && <button className="secondary" onClick={() => void markRead(n.id)}>Marquer comme lue</button>}
        </div>
      ))}
    </>
  );
}
