import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CONTROL } from '../lib/format';
import { frError } from '../lib/errors';
import { callFn } from '../lib/functions';

type Stats = { members: number; posts: number; networks: number; offers: number; open_reports: number; challenges_published: number };
type Report = { id: string; target_type: string; target_id: string; reason: string; details: string | null; evidence_url: string | null; status: string; provider_response: string | null; created_at: string; profiles: { display_name: string } | null };
type Member = { id: string; display_name: string; suspended_at: string | null; is_provider: boolean; control_level: number };
const DECISIONS: [string, string][] = [['request_explanation', 'Demander une explication'], ['dismiss', 'Classer sans suite'], ['warn', 'Avertir'], ['suspend_resource', 'Suspendre la ressource'], ['suspend_account', 'Suspendre le compte'], ['resolve', 'Clore le dossier']];

export default function Admin({ isAdmin }: { isAdmin: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [s, r] = await Promise.all([
      supabase.rpc('komya_admin_stats'),
      supabase.from('reports').select('id,target_type,target_id,reason,details,evidence_url,status,provider_response,created_at,profiles!reports_reporter_id_fkey(display_name)').in('status', ['open', 'reviewing', 'awaiting_response']).order('created_at').limit(50),
    ]);
    if (s.error) setError(frError(s.error)); else setStats(s.data as Stats);
    if (r.error) { setError(frError(r.error)); return; }
    const rows = (r.data ?? []) as unknown as Report[];
    setReports(rows);
    const next: Record<string, string> = {};
    await Promise.all(rows.map(async rep => {
      const map: Record<string, [string, string]> = { post: ['posts', 'body'], comment: ['comments', 'body'], resource: ['resources', 'title'], profile: ['profiles', 'display_name'] };
      const t = map[rep.target_type];
      if (!t) return;
      const { data } = await supabase.from(t[0]).select(t[1]).eq('id', rep.target_id).maybeSingle();
      next[rep.id] = data ? String((data as unknown as Record<string, unknown>)[t[1]] ?? '') : '(contenu introuvable ou déjà masqué)';
    }));
    setPreviews(next);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function rpc(fn: string, args: Record<string, unknown>, ok: string, after?: () => void) {
    setMsg(''); setError('');
    const { error: err } = await supabase.rpc(fn, args);
    if (err) setError(frError(err)); else { setMsg(ok); void load(); after?.(); }
  }
  async function hidePost(id: string) {
    const m = await callFn('delete-post', { post_id: id });
    if (m) setError(m); else { setMsg('Publication supprimée avec ses fichiers.'); void load(); }
  }
  async function findMembers() {
    const term = search.trim().replace(/[%_]/g, '');
    const { data, error: err } = await supabase.from('profiles').select('id,display_name,suspended_at,is_provider,control_level').ilike('display_name', `%${term}%`).limit(10);
    if (err) setError(frError(err)); else setMembers((data ?? []) as Member[]);
  }

  return (
    <>
      <h2>Administration</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {msg && <p role="status">{msg}</p>}
      {stats && (
        <div className="card">
          <b>Vue d’ensemble</b>
          <p>{stats.members} membres · {stats.posts} publications · {stats.networks} réseaux · {stats.challenges_published} défis</p>
          <p><b>{stats.open_reports}</b> signalement(s) à traiter</p>
        </div>
      )}
      <h3>Signalements</h3>
      {reports.length === 0 && <p>Aucun signalement à traiter.</p>}
      {reports.map(r => (
        <div className="card" key={r.id}>
          <small>{r.target_type.toUpperCase()} · {r.status}</small> <b>{r.reason}</b>
          <p>« {previews[r.id] ?? '…'} »</p>
          {r.details && <p><small>Explication : {r.details}</small></p>}
          {r.evidence_url && <p><a href={r.evidence_url} target="_blank" rel="noopener noreferrer">Voir la preuve</a></p>}
          {r.provider_response && <p><small>Version du prestataire : {r.provider_response}</small></p>}
          <small>Signalé par {r.profiles?.display_name ?? 'membre'} · {new Date(r.created_at).toLocaleString('fr-FR')}. Aucune sanction n’est automatique.</small>
          <select aria-label="Décision" value={decision[r.id] ?? 'request_explanation'} onChange={e => setDecision({ ...decision, [r.id]: e.target.value })}>{DECISIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input aria-label="Note de décision" placeholder="Note (visible dans le journal)" value={notes[r.id] ?? ''} onChange={e => setNotes({ ...notes, [r.id]: e.target.value })} />
          {r.target_type === 'post' && <button className="secondary" onClick={() => void hidePost(r.target_id)}>Supprimer la publication et ses fichiers</button>}
          <button onClick={() => void rpc('komya_report_decide', { rid: r.id, p_decision: decision[r.id] ?? 'request_explanation', note: notes[r.id] ?? '' }, 'Décision enregistrée et tracée.')}>Appliquer</button>
        </div>
      ))}
      <h3>Membres</h3>
      <div className="card">
        <input aria-label="Rechercher un membre" placeholder="Nom du membre" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="secondary" onClick={() => void findMembers()}>Rechercher</button>
        {members.map(m => (
          <div key={m.id}><p>{m.display_name} {m.suspended_at && <small>SUSPENDU</small>} {m.is_provider && <small className="cat">Prestataire</small>}</p>
            <div className="row">
              <button className="secondary" onClick={() => void rpc('komya_suspend_user', { target: m.id, suspend: !m.suspended_at, reason: null }, m.suspended_at ? 'Compte réactivé.' : 'Compte suspendu.', () => void findMembers())}>{m.suspended_at ? 'Réactiver' : 'Suspendre'}</button>
              {m.is_provider && (
                <select aria-label="Niveau de contrôle" value={m.control_level} onChange={e => void rpc('komya_set_control_level', { target: m.id, lvl: Number(e.target.value), note: 'Mise à jour par l’administration' }, 'Niveau de contrôle mis à jour.', () => void findMembers())}>
                  {CONTROL.map((l, i) => <option key={l} value={i}>{l}</option>)}
                </select>
              )}
              {isAdmin && <>
                <button className="secondary" onClick={() => void rpc('komya_set_role', { target: m.id, r: 'moderator', grant_it: true }, 'Modérateur nommé.')}>Nommer modérateur</button>
                <button className="secondary" onClick={() => void rpc('komya_set_role', { target: m.id, r: 'moderator', grant_it: false }, 'Rôle retiré.')}>Retirer modérateur</button>
              </>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
