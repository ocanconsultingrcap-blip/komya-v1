import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';

type Challenge = { id: string; title: string; description: string; objective: string | null; difficulty: string; duration_days: number | null; kind: 'campagne' | 'express'; by_member: boolean; created_by: string | null; profiles: { display_name: string } | null };
type Action = { id: string; challenge_id: string; title: string };
type Part = { challenge_id: string; status: string };
const LEVELS: Record<string, string> = { easy: 'Facile', intermediate: 'Moyen', advanced: 'Difficile' };
const EMPTY = { title: '', description: '', objective: '', difficulty: 'easy', kind: 'express', duration_days: 7, actions: '' };

export default function Challenges({ userId }: { userId: string }) {
  const [list, setList] = useState<Challenge[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [done, setDone] = useState<string[]>([]);
  const [staff, setStaff] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [c, p, r] = await Promise.all([
      supabase.from('challenges').select('id,title,description,objective,difficulty,duration_days,kind,by_member,created_by,profiles!challenges_created_by_fkey(display_name)').eq('status', 'published').order('created_at', { ascending: false }).limit(60),
      supabase.from('challenge_participants').select('challenge_id,status').eq('user_id', userId),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);
    const err = c.error ?? p.error ?? r.error;
    if (err) { setError(frError(err)); return; }
    const chs = (c.data ?? []) as unknown as Challenge[];
    setList(chs); setParts((p.data ?? []) as Part[]); setStaff((r.data ?? []).length > 0);
    if (chs.length) {
      const [a, d] = await Promise.all([
        supabase.from('challenge_actions').select('id,challenge_id,title').in('challenge_id', chs.map(x => x.id)).order('position'),
        supabase.from('challenge_action_progress').select('action_id').eq('user_id', userId),
      ]);
      if (a.error ?? d.error) { setError(frError(a.error ?? d.error)); return; }
      setActions((a.data ?? []) as Action[]); setDone((d.data ?? []).map(x => x.action_id as string));
    }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  async function rpc(fn: string, args: Record<string, unknown>, ok?: string) {
    setError(''); setMsg('');
    const { error: err } = await supabase.rpc(fn, args);
    if (err) setError(frError(err)); else { if (ok) setMsg(ok); void load(); }
  }
  async function create(e: FormEvent) {
    e.preventDefault(); setError(''); setMsg('');
    const { data, error: err } = await supabase.from('challenges').insert({
      title: form.title.trim(), description: form.description.trim(), objective: form.objective.trim() || null, difficulty: form.difficulty, kind: form.kind,
      duration_days: form.kind === 'express' ? null : form.duration_days, status: 'published', created_by: userId, by_member: !staff,
    }).select('id').single();
    if (err || !data) { setError(frError(err)); return; }
    const lines = form.actions.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length) {
      const { error: err2 } = await supabase.from('challenge_actions').insert(lines.map((title, i) => ({ challenge_id: data.id as string, title, position: i })));
      if (err2) { setError(frError(err2)); return; }
    }
    setForm(EMPTY); setShowForm(false); setMsg('Ton défi est publié : les autres membres peuvent le relever.'); void load();
  }
  async function withdraw(id: string) {
    const { error: err } = await supabase.from('challenges').update({ status: 'archived' }).eq('id', id);
    if (err) setError(frError(err)); else void load();
  }

  return (
    <>
      <h2>Défis</h2>
      <p><small>Relève un défi pour progresser, ou propose le tien à la communauté.</small></p>
      <button className={showForm ? 'secondary' : ''} onClick={() => setShowForm(!showForm)}>{showForm ? 'Fermer' : '+ Créer un défi'}</button>
      {showForm && (
        <form className="card" onSubmit={e => void create(e)}>
          <b>Créer un défi</b>
          <input aria-label="Titre" placeholder="Titre du défi" required minLength={3} maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <textarea aria-label="Description" placeholder="Que doit faire le membre ?" required minLength={10} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <input aria-label="Objectif" placeholder="Objectif (ce que ça lui apporte)" value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} />
          <select aria-label="Difficulté" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>{Object.entries(LEVELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select aria-label="Type de défi" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="express">Défi express (à faire tout de suite)</option><option value="campagne">Défi sur plusieurs jours</option></select>
          {form.kind === 'campagne' && <input type="number" aria-label="Durée en jours" min={1} max={365} value={form.duration_days} onChange={e => setForm({ ...form, duration_days: Number(e.target.value) })} />}
          {form.kind === 'campagne' && <textarea aria-label="Étapes" placeholder="Étapes à cocher, une par ligne (facultatif)" value={form.actions} onChange={e => setForm({ ...form, actions: e.target.value })} />}
          <button>Publier le défi</button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {msg && <p role="status">{msg}</p>}
      {list.length === 0 && <p>Aucun défi disponible pour le moment. Crée le premier !</p>}
      {list.map(c => {
        const p = parts.find(x => x.challenge_id === c.id);
        const completed = p?.status === 'completed';
        const acts = actions.filter(a => a.challenge_id === c.id);
        const joined = !!p && p.status !== 'withdrawn';
        return (
          <article className="card" key={c.id}>
            <b>{c.title}</b>
            <p><small className="cat">{c.kind === 'express' ? 'Express' : `${c.duration_days ?? '?'} jours`}</small><small className="cat">{LEVELS[c.difficulty] ?? c.difficulty}</small><small className="cat">{c.by_member ? `Par ${c.profiles?.display_name ?? 'un membre'}` : 'Défi KOMYA'}</small></p>
            <p>{c.description}</p>
            {c.objective && <p><small>Objectif : {c.objective}</small></p>}
            {completed ? <p><b>✅ Défi terminé, bravo !</b></p> : (
              <>
                {c.kind === 'campagne' && !joined && <button className="secondary" onClick={() => void rpc('komya_join_challenge', { cid: c.id })}>Participer</button>}
                {joined && acts.map(a => (
                  <label key={a.id} style={{ display: 'block', margin: '6px 0' }}>
                    <input type="checkbox" checked={done.includes(a.id)} onChange={e => void rpc('komya_toggle_action', { aid: a.id, done: e.target.checked })} /> {a.title}
                  </label>
                ))}
                <button onClick={() => void rpc('komya_complete_challenge', { cid: c.id }, 'Défi terminé : bravo !')}>{c.kind === 'express' ? 'Fait !' : 'J’ai terminé ce défi'}</button>
              </>
            )}
            {(c.created_by === userId || staff) && <> <button className="secondary" onClick={() => void withdraw(c.id)}>Retirer ce défi</button></>}
          </article>
        );
      })}
    </>
  );
}
