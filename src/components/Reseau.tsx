import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import Networks from './Networks';
import ProfileView from './ProfileView';
import { CONTROL } from '../lib/format';
import Avatar from './Avatar';

type Member = { id: string; display_name: string; country: string | null; city: string | null; sector: string | null; business_name: string | null; is_provider: boolean; control_level: number; avatar_url: string | null };

export default function Reseau({ userId, onOpenResource }: { userId: string; onOpenResource: (id: string) => void }) {
  const [view, setView] = useState<'members' | 'networks'>('members');
  const [q, setQ] = useState('');
  const [sector, setSector] = useState('');
  const [country, setCountry] = useState('');
  const [providers, setProviders] = useState(false);
  const [list, setList] = useState<Member[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const clean = (s: string) => s.trim().replace(/[%_]/g, '');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    let query = supabase.from('profiles').select('id,display_name,country,city,sector,business_name,is_provider,control_level,avatar_url').neq('id', userId).is('suspended_at', null).order('created_at', { ascending: false }).limit(40);
    if (clean(q)) query = query.or(`display_name.ilike.%${clean(q)}%,business_name.ilike.%${clean(q)}%`);
    if (clean(sector)) query = query.ilike('sector', `%${clean(sector)}%`);
    if (clean(country)) query = query.ilike('country', `%${clean(country)}%`);
    if (providers) query = query.eq('is_provider', true);
    const { data, error: err } = await query;
    setLoading(false);
    if (err) setError(frError(err)); else setList((data ?? []) as Member[]);
  }, [q, sector, country, providers, userId]);
  useEffect(() => { if (view === 'members') void load(); }, [load, view]);

  if (open) return <ProfileView targetId={open} userId={userId} onBack={() => setOpen(null)} onOpenResource={onOpenResource} />;
  return (
    <>
      <div className="chips">
        <button className={view === 'members' ? 'on' : ''} onClick={() => setView('members')}>Membres</button>
        <button className={view === 'networks' ? 'on' : ''} onClick={() => setView('networks')}>Réseaux</button>
      </div>
      {view === 'networks' && <Networks userId={userId} />}
      {view === 'members' && (
        <>
          <h2>Découvrir des membres</h2>
          <input aria-label="Rechercher" placeholder="Nom ou entreprise" value={q} onChange={e => setQ(e.target.value)} />
          <input aria-label="Secteur" placeholder="Secteur d’activité" value={sector} onChange={e => setSector(e.target.value)} />
          <input aria-label="Pays" placeholder="Pays" value={country} onChange={e => setCountry(e.target.value)} />
          <label><input type="checkbox" checked={providers} onChange={e => setProviders(e.target.checked)} /> Prestataires seulement</label>
          {error && <p className="error" role="alert">{error}</p>}
          {loading && <p>Chargement…</p>}
          {!loading && list.length === 0 && <p>Aucun membre trouvé avec ces critères.</p>}
          {list.map(m => (
            <div className="card" key={m.id}>
              <p style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}><Avatar name={m.display_name} url={m.avatar_url} size={44} /><b>{m.display_name}</b></p>{m.is_provider && <small className="cat">Prestataire</small>}
              <p><small>{[m.business_name, m.sector, [m.city, m.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Profil à compléter'}</small></p>
              {m.is_provider && <p><small>{CONTROL[m.control_level]}</small></p>}
              <button className="secondary" onClick={() => setOpen(m.id)}>Voir le profil</button>
            </div>
          ))}
        </>
      )}
    </>
  );
}
