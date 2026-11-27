import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import { BADGES, CONTROL, INTRO_CTXS, stars } from '../lib/format';
import ReportButton from './ReportButton';
import Avatar from './Avatar';

type Prof = { id: string; avatar_url: string | null; display_name: string; country: string | null; city: string | null; sector: string | null; business_name: string | null; member_type: string; bio: string | null; is_provider: boolean; expertise: string | null; experience_text: string | null; references_text: string | null; control_level: number; control_note: string | null };
type Stats = { score: number; level: string; next_level_at: number | null; streak: number; badges: string[]; trust: string[] };
type Summary = { resources: number; avg_rating: number | null; review_count: number };
type Res = { id: string; title: string; kind: string };

export default function ProfileView({ targetId, userId, onBack, onOpenResource }: { targetId: string; userId: string; onBack: () => void; onOpenResource?: (id: string) => void }) {
  const [p, setP] = useState<Prof | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sum, setSum] = useState<Summary | null>(null);
  const [res, setRes] = useState<Res[]>([]);
  const [nets, setNets] = useState<string[]>([]);
  const [ctx, setCtx] = useState(INTRO_CTXS[0]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const [a, b, c, d, e] = await Promise.all([
        supabase.from('profiles').select('id,avatar_url,display_name,country,city,sector,business_name,member_type,bio,is_provider,expertise,experience_text,references_text,control_level,control_note').eq('id', targetId).single(),
        supabase.rpc('komya_member_stats', { uid: targetId }),
        supabase.rpc('komya_provider_summary', { pid: targetId }),
        supabase.from('resources').select('id,title,kind').eq('created_by', targetId).eq('published', true).is('suspended_at', null).limit(20),
        supabase.from('network_members').select('networks(name)').eq('user_id', targetId).eq('status', 'active').limit(20),
      ]);
      if (a.error) { setError(frError(a.error)); return; }
      setP(a.data as Prof); setStats((b.data ?? null) as Stats | null); setSum((c.data ?? null) as Summary | null);
      setRes((d.data ?? []) as Res[]);
      setNets((e.data ?? []).map(x => (x.networks as unknown as { name: string } | null)?.name).filter((n): n is string => !!n));
    })();
  }, [targetId]);

  async function write() {
    setError(''); setMsg('');
    const { error: err } = await supabase.rpc('komya_start_conversation', { other: targetId, ctx });
    if (err) setError(frError(err)); else setMsg('Conversation ouverte : retrouve-la dans l’onglet Message.');
  }

  if (error && !p) return <><button className="secondary" onClick={onBack}>← Retour</button><p className="error" role="alert">{error}</p></>;
  if (!p) return <p>Chargement…</p>;
  return (
    <>
      <button className="secondary" onClick={onBack}>← Retour</button>
      <div className="card">
        <p style={{ display: 'flex', alignItems: 'center', gap: 12, margin: 0 }}><Avatar name={p.display_name} url={p.avatar_url} size={64} /><span style={{ fontSize: 22, fontWeight: 800 }}>{p.display_name}</span></p>
        <p><small>{[p.business_name, p.sector, [p.city, p.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</small></p>
        {p.bio && <p>{p.bio}</p>}
        {stats && <p><b>{stats.level}</b> <small>{stats.score} points{stats.next_level_at ? `, prochain niveau à ${stats.next_level_at}` : ''}{stats.streak ? `, série de ${stats.streak} jour(s)` : ''}</small></p>}
        {stats && [...stats.badges, ...stats.trust].length > 0 && <p>{[...stats.badges, ...stats.trust].map(k => <small key={k} className="cat">{BADGES[k] ?? k}</small>)}</p>}
        {nets.length > 0 && <p><small>Réseaux : {nets.join(', ')}</small></p>}
      </div>
      {p.is_provider && (
        <div className="card">
          <b>Prestataire</b>
          <p><small>Niveau de contrôle : {CONTROL[p.control_level] ?? CONTROL[0]}. Ce niveau est distinct des avis des clients.</small></p>
          {p.expertise && <p>Expertise : {p.expertise}</p>}
          {p.experience_text && <p>Expérience déclarée : {p.experience_text}</p>}
          {p.references_text && <p>Références : {p.references_text}</p>}
          {sum && <p><small>{sum.resources} ressource(s) · {stars(sum.avg_rating)}{sum.review_count ? ` (${sum.review_count} avis)` : ''}</small></p>}
          {res.map(r => <p key={r.id}>{onOpenResource ? <button className="secondary" onClick={() => onOpenResource(r.id)}>{r.title}</button> : r.title} <small>Gratuit</small></p>)}
        </div>
      )}
      {targetId !== userId && (
        <div className="card">
          <select aria-label="Motif du message" value={ctx} onChange={e => setCtx(e.target.value)}>{INTRO_CTXS.map(c => <option key={c}>{c}</option>)}</select>
          <div className="row"><button onClick={() => void write()}>Écrire</button><ReportButton userId={userId} targetType="profile" targetId={targetId} /></div>
          {msg && <p role="status">{msg}</p>}{error && <p className="error" role="alert">{error}</p>}
        </div>
      )}
    </>
  );
}
