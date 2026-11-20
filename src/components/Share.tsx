import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';

type Invite = { id: string; guest_name: string; code: string; used_by: string | null; recovered: boolean };

export default function Share({ userId }: { userId: string }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const base = window.location.origin;
  const text = 'Rejoins-moi sur KOMYA : la communauté qui aide les entrepreneurs à apprendre, partager et se développer.';

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('invites').select('id,guest_name,code,used_by,recovered').eq('inviter_id', userId).order('created_at', { ascending: false });
    if (err) setError(frError(err)); else setInvites((data ?? []) as Invite[]);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  async function share(t: string, url: string) {
    setMsg(''); setError('');
    if (navigator.share) { try { await navigator.share({ title: 'KOMYA', text: t, url }); return; } catch { /* partage annulé */ } }
    try { await navigator.clipboard.writeText(`${t} ${url}`); setMsg('Lien copié : colle-le dans WhatsApp ou un message.'); }
    catch { setMsg(`${t} ${url}`); }
  }
  async function create(e: FormEvent) {
    e.preventDefault(); setError(''); setMsg('');
    const { data, error: err } = await supabase.rpc('komya_create_invite', { gname: name, gcontact: contact, gnote: note });
    if (err) { setError(frError(err)); return; }
    setName(''); setContact(''); setNote(''); setMsg(`Clé créée : ${String(data)}`); void load();
  }
  const link = (code: string) => `${base}/?invite=${code}`;

  return (
    <div className="card">
      <b>Partager KOMYA</b>
      <p><small>Fais connaître l’application à d’autres entrepreneurs.</small></p>
      <div className="row">
        <button onClick={() => void share(text, base)}>Partager l’application</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${base}`)}`} target="_blank" rel="noopener noreferrer"><button className="secondary">WhatsApp</button></a>
      </div>
      <h3>Inviter quelqu’un avec une clé</h3>
      <p><small>Tu as 3 clés par mois. Une clé te revient quand la personne invitée fait sa première contribution.</small></p>
      <form onSubmit={e => void create(e)}>
        <input aria-label="Prénom de la personne" placeholder="Prénom de la personne" required value={name} onChange={e => setName(e.target.value)} />
        <input aria-label="Contact" placeholder="Téléphone ou e-mail (facultatif)" value={contact} onChange={e => setContact(e.target.value)} />
        <input aria-label="Note" placeholder="Pourquoi l’inviter ? (facultatif)" value={note} onChange={e => setNote(e.target.value)} />
        <button>Créer une clé</button>
      </form>
      {msg && <p role="status">{msg}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {invites.map(i => (
        <p key={i.id}><b>{i.guest_name}</b> <small>{i.code}</small>{' '}
          <small>{i.recovered ? 'Clé récupérée' : i.used_by ? 'A rejoint KOMYA' : 'En attente'}</small>{' '}
          {!i.used_by && <button className="secondary" onClick={() => void share(`${text} Ma clé : ${i.code}`, link(i.code))}>Envoyer</button>}
        </p>
      ))}
    </div>
  );
}
