import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import { KINDS, RES_CATS, stars } from '../lib/format';
import ResourceDetail from './ResourceDetail';
import ProviderSpace from './ProviderSpace';
import ProfileView from './ProfileView';
import Countdown from './Countdown';

type Row = { id: string; title: string; summary: string | null; category: string | null; kind: string; created_by: string | null; expires_at: string | null; profiles: { display_name: string } | null };
type Stat = { resource_id: string; avg_rating: number | null; review_count: number; access_count: number };
type Mine = { resource_id: string; granted_at: string; resources: { title: string } | null };
type Sub = 'catalog' | 'mine' | 'provider';

export default function Resources({ userId, initialResource, startOn, onClearInitial }: { userId: string; initialResource: string | null; startOn: 'provider' | null; onClearInitial: () => void }) {
  const [sub, setSub] = useState<Sub>('catalog');
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState<string | null>(initialResource);
  const [prof, setProf] = useState<string | null>(null);
  const [mine, setMine] = useState<Mine[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialResource) setOpen(initialResource);
    if (startOn === 'provider') { setSub('provider'); setOpen(null); }
    if (initialResource || startOn) onClearInitial();
  }, [initialResource, startOn, onClearInitial]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    let query = supabase.from('resources').select('id,title,summary,category,kind,created_by,expires_at,profiles!resources_created_by_fkey(display_name)')
      .eq('published', true).is('suspended_at', null).order('created_at', { ascending: false }).limit(40);
    const term = q.trim().replace(/[%_]/g, '');
    if (term) query = query.ilike('title', `%${term}%`);
    if (kind) query = query.eq('kind', kind);
    if (cat) query = query.eq('category', cat);
    const { data, error: err } = await query;
    setLoading(false);
    if (err) { setError(frError(err)); return; }
    const list = (data ?? []) as unknown as Row[];
    setRows(list);
    if (list.length) {
      const s = await supabase.rpc('komya_resource_stats', { rids: list.map(r => r.id) });
      setStats(Object.fromEntries(((s.data ?? []) as Stat[]).map(x => [x.resource_id, x])));
    }
  }, [q, kind, cat]);
  useEffect(() => { if (sub === 'catalog') void load(); }, [load, sub]);
  useEffect(() => {
    if (sub !== 'mine') return;
    void supabase.from('resource_access').select('resource_id,granted_at,resources(title)').eq('user_id', userId).order('granted_at', { ascending: false }).limit(50)
      .then(({ data, error: err }) => { if (err) setError(frError(err)); else setMine((data ?? []) as unknown as Mine[]); });
  }, [sub, userId]);

  if (prof) return <ProfileView targetId={prof} userId={userId} onBack={() => setProf(null)} onOpenResource={id => { setProf(null); setOpen(id); }} />;
  if (open) return <ResourceDetail id={open} userId={userId} onBack={() => setOpen(null)} onProvider={setProf} />;
  const tabs: [Sub, string][] = [['catalog', 'Catalogue'], ['mine', 'Mes accès'], ['provider', '🏪 Espace prestataire']];
  return (
    <>
      <div className="chips">{tabs.map(([k, l]) => <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>)}</div>
      {error && <p className="error" role="alert">{error}</p>}
      {sub === 'provider' && <ProviderSpace userId={userId} />}
      {sub === 'mine' && (
        <>
          <h2>Mes accès</h2>
          {mine.length === 0 && <p>Tu n’as encore accédé à aucune ressource.</p>}
          {mine.map(p => <div className="card" key={p.resource_id}><b>{p.resources?.title ?? 'Ressource'}</b> <small>depuis le {new Date(p.granted_at).toLocaleDateString('fr-FR')}</small> <button className="secondary" onClick={() => setOpen(p.resource_id)}>Ouvrir</button></div>)}
        </>
      )}
      {sub === 'catalog' && (
        <>
          <h2>Ressources</h2>
          <p><small>Formations, outils, modèles et accompagnements, gratuits pour le moment.</small></p>
          <div className="card">
            <b>Tu as un savoir-faire à partager ?</b>
            <p><small>Publie une formation, un outil ou un service et suis les accès et les avis dans ton espace prestataire.</small></p>
            <button onClick={() => setSub('provider')}>🏪 Publier une ressource</button>
          </div>
          <input aria-label="Rechercher" placeholder="Rechercher une ressource" value={q} onChange={e => setQ(e.target.value)} />
          <div className="row">
            <select aria-label="Type" value={kind} onChange={e => setKind(e.target.value)}><option value="">Tous les types</option>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select aria-label="Catégorie" value={cat} onChange={e => setCat(e.target.value)}><option value="">Toutes les catégories</option>{RES_CATS.map(c => <option key={c}>{c}</option>)}</select>
          </div>
          {loading && <p>Chargement…</p>}
          {!loading && rows.length === 0 && <p>Aucune ressource ne correspond. Essaie d’autres filtres.</p>}
          {rows.map(r => (
            <div className="card" key={r.id}>
              <b>{r.title}</b> <small className="cat">{KINDS[r.kind] ?? r.kind}</small>{r.expires_at && <Countdown until={r.expires_at} />}
              {r.summary && <p>{r.summary}</p>}
              <p><small>{stars(stats[r.id]?.avg_rating)}{stats[r.id]?.review_count ? ` (${stats[r.id].review_count})` : ''} · {r.created_by ? (r.profiles?.display_name ?? 'Prestataire') : 'Équipe KOMYA'}</small></p>
              <button onClick={() => setOpen(r.id)}>Voir la fiche</button>
            </div>
          ))}
        </>
      )}
    </>
  );
}
