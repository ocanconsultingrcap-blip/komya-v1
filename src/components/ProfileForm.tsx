import type { FormEvent, ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import { compressSquare } from '../lib/image';
import Avatar from './Avatar';

type P = { display_name: string; country: string; city: string; sector: string; business_name: string; bio: string; member_type: string };
const empty: P = { display_name: '', country: '', city: '', sector: '', business_name: '', bio: '', member_type: 'entrepreneur' };
const TYPES: [string, string][] = [['entrepreneur', 'Entrepreneur'], ['independent', 'Indépendant'], ['project_owner', 'Porteur de projet'], ['professional', 'Professionnel'], ['organization', 'Organisation']];

export default function ProfileForm({ userId }: { userId: string }) {
  const [p, setP] = useState<P>(empty);
  const [msg, setMsg] = useState('');
  const [dash, setDash] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [stats, setStats] = useState<{ score: number; level: string; next_level_at: number | null; streak: number } | null>(null);

  useEffect(() => {
    supabase.from('profiles').select('display_name,country,city,sector,business_name,bio,member_type,avatar_url').eq('id', userId).single()
      .then(({ data, error: err }) => {
        if (err) setError(frError(err));
        else if (data) { const { avatar_url, ...rest } = data as Record<string, string | null>; setAvatar(avatar_url ?? null); setP({ ...empty, ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v ?? ''])) }); }
      });
  }, [userId]);
  useEffect(() => { void supabase.rpc('komya_member_stats', { uid: userId }).then(({ data }) => { if (data) setStats(data as typeof stats); }); }, [userId]);
  useEffect(() => { void supabase.rpc('komya_dashboard').then(({ data }) => { if (data) setDash(data as Record<string, number>); }); }, [userId]);

  async function changePhoto(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    setMsg(''); setError('');
    if (!f.type.startsWith('image/')) { setError('Choisis une photo (JPG, PNG ou WebP).'); return; }
    try {
      const small = await compressSquare(f);
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const up = await supabase.storage.from('avatars').upload(path, small, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const { error: err } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
      if (err) throw err;
      const old = avatar?.split('/avatars/')[1];
      if (old) await supabase.storage.from('avatars').remove([decodeURIComponent(old)]);
      setAvatar(url); setMsg('Photo de profil mise à jour.');
    } catch (e) { setError(frError(e)); }
  }
  async function removePhoto() {
    const old = avatar?.split('/avatars/')[1];
    const { error: err } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
    if (err) { setError(frError(err)); return; }
    if (old) await supabase.storage.from('avatars').remove([decodeURIComponent(old)]);
    setAvatar(null); setMsg('Photo retirée.');
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setMsg(''); setError('');
    const { error: err } = await supabase.from('profiles').update({ ...p, updated_at: new Date().toISOString() }).eq('id', userId);
    if (err) setError(frError(err)); else setMsg('Profil enregistré.');
  }
  const set = (k: keyof P) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setP({ ...p, [k]: e.target.value });

  return (
    <>
    {dash && (
      <div className="card">
        <b>Mon activité</b>
        {stats && <p><b>{stats.level}</b> <small>{stats.score} points{stats.next_level_at ? `, prochain niveau à ${stats.next_level_at}` : ''}{stats.streak ? ` · série de ${stats.streak} jour(s)` : ''}</small></p>}
        <p>{dash.posts} publication(s), {dash.comments} commentaire(s), {dash.networks} réseau(x)</p>
        <p>{dash.challenges_completed} défi(s) terminé(s) sur {dash.challenges_joined} suivi(s)</p>
      </div>
    )}
    <form className="card" onSubmit={e => void save(e)}>
      <h2>Mon profil</h2>
      <div className="row" style={{ alignItems: 'center' }}>
        <Avatar name={p.display_name} url={avatar} size={72} />
        <label className="filebtn">📷 {avatar ? 'Changer la photo' : 'Ajouter une photo'}<input className="sr" type="file" accept="image/*" onChange={e => { void changePhoto(e.target.files); e.target.value = ''; }} /></label>
        {avatar && <button type="button" className="secondary" onClick={() => void removePhoto()}>Retirer</button>}
      </div>
      <input aria-label="Nom affiché" placeholder="Nom affiché" required value={p.display_name} onChange={set('display_name')} maxLength={80} />
      <select aria-label="Type de membre" value={p.member_type} onChange={set('member_type')}>
        {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input aria-label="Activité / entreprise" placeholder="Activité / entreprise" value={p.business_name} onChange={set('business_name')} />
      <input aria-label="Secteur" placeholder="Secteur" value={p.sector} onChange={set('sector')} />
      <input aria-label="Pays" placeholder="Pays" value={p.country} onChange={set('country')} />
      <input aria-label="Ville" placeholder="Ville" value={p.city} onChange={set('city')} />
      <textarea aria-label="Bio" placeholder="Présentez-vous en quelques lignes" value={p.bio} onChange={set('bio')} maxLength={1000} />
      <button>Enregistrer</button>
      {msg && <p role="status">{msg}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
    </>
  );
}
