import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import { INTRO_CTXS } from '../lib/format';

type Conv = { id: string; otherId: string; name: string; status: string; requesterId: string | null; expiresAt: string | null; context: string | null };
type Msg = { id: string; sender_id: string; body: string; created_at: string; delivered_at: string | null; read_at: string | null };
type Found = { id: string; display_name: string };

const effective = (c: Conv) => (c.status === 'pending' && c.expiresAt && new Date(c.expiresAt) < new Date() ? 'expired' : c.status);

function Thread({ conv, userId, onBack, onChanged }: { conv: Conv; userId: string; onBack: () => void; onChanged: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [status, setStatus] = useState(effective(conv));
  const bottom = useRef<HTMLDivElement>(null);
  const mineRequest = conv.requesterId === userId;

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('messages').select('id,sender_id,body,created_at,delivered_at,read_at')
      .eq('conversation_id', conv.id).order('created_at').limit(200);
    if (err) { setError(frError(err)); return; }
    setMsgs((data ?? []) as Msg[]);
    void supabase.rpc('komya_mark_read', { cid: conv.id });
  }, [conv.id]);

  useEffect(() => {
    void load();
    const ch = supabase.channel(`msg-${conv.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [conv.id, load]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  const canSend = status === 'active' || (status === 'pending' && mineRequest && msgs.length === 0);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const { error: err } = await supabase.from('messages').insert({ conversation_id: conv.id, sender_id: userId, body });
    if (err) setError(frError(err)); else { setDraft(''); setError(''); void load(); }
  }
  async function respond(accept: boolean) {
    const { error: err } = await supabase.rpc('komya_respond_message_request', { cid: conv.id, accept });
    if (err) { setError(frError(err)); return; }
    setStatus(accept ? 'active' : 'declined'); onChanged();
  }
  async function block() {
    const { error: err } = await supabase.from('blocks').insert({ blocker_id: userId, blocked_id: conv.otherId });
    if (err) setError(frError(err)); else setInfo('Membre bloqué : il ne peut plus vous écrire.');
  }

  return (
    <>
      <button className="secondary" onClick={onBack}>← Messages</button>
      <h2>{conv.name}</h2>
      {conv.context && <p><small>Motif : {conv.context}</small></p>}
      {error && <p className="error" role="alert">{error}</p>}
      {info && <p role="status">{info}</p>}
      {status === 'pending' && !mineRequest && (
        <div className="card">
          <b>{conv.name} souhaite vous écrire</b>
          <p><small>Vous ne partagez pas encore de réseau. Acceptez pour démarrer la conversation.</small></p>
          <div className="row"><button onClick={() => void respond(true)}>Accepter</button><button className="secondary" onClick={() => void respond(false)}>Refuser</button></div>
        </div>
      )}
      <div className="thread">
        {msgs.length === 0 && <p>{canSend ? 'Présentez-vous en un message : le membre pourra accepter votre demande.' : 'Aucun message.'}</p>}
        {msgs.map(m => (
          <div key={m.id} className={m.sender_id === userId ? 'bubble me' : 'bubble'}>
            {m.body}<small>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{m.sender_id === userId && <span className={m.read_at ? 'tick read' : 'tick'} title={m.read_at ? 'Lu' : m.delivered_at ? 'Reçu' : 'Envoyé'} aria-label={m.read_at ? 'Message lu' : m.delivered_at ? 'Message reçu' : 'Message envoyé'}>{m.delivered_at || m.read_at ? ' ✓✓' : ' ✓'}</span>}</small>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {status === 'pending' && mineRequest && msgs.length > 0 && <p><small>Demande envoyée. Vous pourrez continuer dès que {conv.name} l’aura acceptée.</small></p>}
      {status === 'declined' && <p><small>Cette demande a été déclinée.</small></p>}
      {status === 'expired' && <p><small>Cette demande a expiré.</small></p>}
      {canSend && (
        <form className="composer" onSubmit={e => void send(e)}>
          <input aria-label="Votre message" placeholder="Votre message" maxLength={5000} value={draft} onChange={e => setDraft(e.target.value)} />
          <button disabled={!draft.trim()}>Envoyer</button>
        </form>
      )}
      <button className="secondary" onClick={() => void block()}>Bloquer ce membre</button>
    </>
  );
}

export default function Messages({ userId }: { userId: string }) {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [open, setOpen] = useState<Conv | null>(null);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState(INTRO_CTXS[0]);
  const [found, setFound] = useState<Found[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const mine = await supabase.from('conversation_members').select('conversation_id').eq('user_id', userId);
    if (mine.error) { setError(frError(mine.error)); return; }
    const ids = (mine.data ?? []).map(r => r.conversation_id as string);
    if (ids.length === 0) { setConvs([]); return; }
    const [cs, others] = await Promise.all([
      supabase.from('conversations').select('id,status,requester_id,expires_at,context').in('id', ids),
      supabase.from('conversation_members').select('conversation_id,user_id,profiles(display_name)').in('conversation_id', ids).neq('user_id', userId),
    ]);
    if (cs.error || others.error) { setError(frError(cs.error ?? others.error, '')); return; }
    const meta = new Map((cs.data ?? []).map(c => [c.id as string, c]));
    setConvs((others.data ?? []).map(o => {
      const c = meta.get(o.conversation_id as string);
      return {
        id: o.conversation_id as string, otherId: o.user_id as string,
        name: (o.profiles as unknown as { display_name: string } | null)?.display_name ?? 'Membre KOMYA',
        status: (c?.status as string) ?? 'active', requesterId: (c?.requester_id as string | null) ?? null,
        expiresAt: (c?.expires_at as string | null) ?? null, context: (c?.context as string | null) ?? null,
      };
    }));
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  async function find() {
    const term = search.trim().replace(/[%_]/g, '');
    if (!term) return;
    const { data, error: err } = await supabase.from('profiles').select('id,display_name').ilike('display_name', `%${term}%`).neq('id', userId).limit(8);
    if (err) setError(frError(err)); else setFound((data ?? []) as Found[]);
  }
  async function start(f: Found) {
    const { data, error: err } = await supabase.rpc('komya_start_conversation', { other: f.id, ctx: reason.trim() || null });
    if (err) { setError(frError(err)); return; }
    const cid = data as string;
    const { data: c } = await supabase.from('conversations').select('status,requester_id,expires_at,context').eq('id', cid).single();
    setOpen({ id: cid, otherId: f.id, name: f.display_name, status: (c?.status as string) ?? 'active', requesterId: (c?.requester_id as string | null) ?? userId,
      expiresAt: (c?.expires_at as string | null) ?? null, context: (c?.context as string | null) ?? null });
    setFound([]); setSearch(''); setReason(INTRO_CTXS[0]); void load();
  }
  async function respond(c: Conv, accept: boolean) {
    const { error: err } = await supabase.rpc('komya_respond_message_request', { cid: c.id, accept });
    if (err) setError(frError(err)); else void load();
  }

  if (open) return <Thread conv={open} userId={userId} onBack={() => { setOpen(null); void load(); }} onChanged={() => void load()} />;

  const received = convs.filter(c => effective(c) === 'pending' && c.requesterId !== userId);
  const active = convs.filter(c => effective(c) === 'active');
  const sent = convs.filter(c => ['pending', 'expired'].includes(effective(c)) && c.requesterId === userId);
  return (
    <>
      <h2>Messages</h2>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="card">
        <b>Nouvelle conversation</b>
        <input aria-label="Nom du membre" placeholder="Rechercher un membre" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="Motif" value={reason} onChange={e => setReason(e.target.value)}>{INTRO_CTXS.map(c => <option key={c}>{c}</option>)}</select>
        <button className="secondary" onClick={() => void find()}>Rechercher</button>
        <p><small>Si vous partagez un réseau, la conversation démarre tout de suite. Sinon, le membre doit d’abord accepter votre demande (valable 7 jours).</small></p>
        {found.map(f => <p key={f.id}>{f.display_name} <button onClick={() => void start(f)}>Écrire</button></p>)}
      </div>
      {received.length > 0 && <h3>Demandes reçues</h3>}
      {received.map(c => (
        <div className="card" key={c.id}>
          <b>{c.name}</b>{c.context && <p><small>{c.context}</small></p>}
          <div className="row">
            <button onClick={() => setOpen(c)}>Lire</button>
            <button onClick={() => void respond(c, true)}>Accepter</button>
            <button className="secondary" onClick={() => void respond(c, false)}>Refuser</button>
          </div>
        </div>
      ))}
      <h3>Conversations</h3>
      {active.length === 0 && <p>Aucune conversation pour le moment.</p>}
      {active.map(c => <div className="card" key={c.id}><b>{c.name}</b> <button onClick={() => setOpen(c)}>Ouvrir</button></div>)}
      {sent.length > 0 && <h3>Demandes envoyées</h3>}
      {sent.map(c => (
        <div className="card" key={c.id}><b>{c.name}</b>{' '}
          <small>{effective(c) === 'expired' ? 'Expirée' : `En attente jusqu’au ${new Date(c.expiresAt ?? Date.now()).toLocaleDateString('fr-FR')}`}</small>{' '}
          <button className="secondary" onClick={() => setOpen(c)}>Ouvrir</button></div>
      ))}
    </>
  );
}
