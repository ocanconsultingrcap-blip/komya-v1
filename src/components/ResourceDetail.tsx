import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import { CONTROL, DELIVERY, KINDS, stars } from '../lib/format';
import ReportButton from './ReportButton';
import Countdown from './Countdown';
import { callFn } from '../lib/functions';

type Res = { id: string; title: string; summary: string | null; category: string | null; kind: string; created_by: string | null; access_conditions: string | null; delivery_mode: string; duration: string | null; sessions: string | null; contact_mode: string | null; suspended_at: string | null; expires_at: string | null; profiles: { display_name: string; control_level: number } | null };
type Content = { body: string | null; file_path: string | null; link_url: string | null; file_name: string | null };
type Review = { id: string; rating: number; comment: string | null; created_at: string; profiles: { display_name: string } | null };
type Stat = { avg_rating: number | null; review_count: number; access_count: number };
type Elig = { allowed: boolean; reason?: string };

export default function ResourceDetail({ id, userId, onBack, onProvider }: { id: string; userId: string; onBack: () => void; onProvider: (id: string) => void }) {
  const [r, setR] = useState<Res | null>(null);
  const [stat, setStat] = useState<Stat | null>(null);
  const [access, setAccess] = useState(false);
  const [content, setContent] = useState<Content | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [elig, setElig] = useState<Elig | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [staff, setStaff] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [a, s, acc, rev, el, roles] = await Promise.all([
      supabase.from('resources').select('id,title,summary,category,kind,created_by,access_conditions,delivery_mode,duration,sessions,contact_mode,suspended_at,expires_at,profiles(display_name,control_level)').eq('id', id).single(),
      supabase.rpc('komya_resource_stats', { rids: [id] }),
      supabase.from('resource_access').select('resource_id').eq('resource_id', id).eq('user_id', userId).maybeSingle(),
      supabase.from('resource_reviews').select('id,rating,comment,created_at,profiles(display_name)').eq('resource_id', id).order('created_at', { ascending: false }).limit(30),
      supabase.rpc('komya_review_eligibility', { rid: id }),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);
    setStaff((roles.data ?? []).length > 0);
    if (a.error) { setError(frError(a.error)); return; }
    const res = a.data as unknown as Res;
    setR(res);
    setStat(((s.data ?? [])[0] ?? null) as Stat | null);
    const has = !!acc.data || res.created_by === userId;
    setAccess(has);
    setReviews((rev.data ?? []) as unknown as Review[]);
    setElig((el.data ?? null) as Elig | null);
    if (has) {
      const c = await supabase.rpc('komya_resource_content', { rid: id });
      if (!c.error) setContent(c.data as Content);
    }
  }, [id, userId]);
  useEffect(() => { void load(); }, [load]);

  async function activate() {
    const { error: err } = await supabase.rpc('komya_get_free_resource', { rid: id });
    if (err) setError(frError(err)); else { setMsg('Ressource ajoutée à tes accès.'); void load(); }
  }
  async function removeResource() {
    if (!window.confirm('Supprimer définitivement cette ressource ? Ses fichiers seront effacés et les membres n’y auront plus accès.')) return;
    const m = await callFn('delete-resource', { resource_id: id });
    if (m) setError(m); else onBack();
  }
  async function openFile() {
    if (!content?.file_path) return;
    const { data, error: err } = await supabase.storage.from('resource-files').createSignedUrl(content.file_path, 120);
    if (err || !data) setError(frError(err, 'Fichier indisponible.')); else window.open(data.signedUrl, '_blank', 'noopener');
  }
  async function review(e: FormEvent) {
    e.preventDefault();
    const { error: err } = await supabase.from('resource_reviews').insert({ resource_id: id, author_id: userId, rating, comment: comment.trim() || null });
    if (err) setError(frError(err)); else { setComment(''); setMsg('Merci pour ton avis.'); void load(); }
  }

  if (!r) return <><button className="secondary" onClick={onBack}>← Retour</button>{error ? <p className="error" role="alert">{error}</p> : <p>Chargement…</p>}</>;
  const owner = r.created_by === userId;
  return (
    <>
      <button className="secondary" onClick={onBack}>← Retour</button>
      <div className="card">
        <h2>{r.title}</h2>
        <p><small className="cat">{KINDS[r.kind] ?? r.kind}</small>{r.category && <small className="cat">{r.category}</small>}<small className="cat">Gratuit</small>{r.expires_at && <Countdown until={r.expires_at} />}</p>
        {r.summary && <p>{r.summary}</p>}
        <p><small>{stars(stat?.avg_rating)}{stat?.review_count ? ` (${stat.review_count} avis)` : ''} · {stat?.access_count ?? 0} accès</small></p>
        <p><small>Livraison : {DELIVERY[r.delivery_mode] ?? r.delivery_mode}{r.duration ? ` · Durée : ${r.duration}` : ''}{r.sessions ? ` · Séances : ${r.sessions}` : ''}</small></p>
        {r.access_conditions && <p><small>Conditions d’accès : {r.access_conditions}</small></p>}
        {r.contact_mode && <p><small>Prise de contact : {r.contact_mode}</small></p>}
        <p>{r.created_by ? <><button className="secondary" onClick={() => onProvider(r.created_by as string)}>{r.profiles?.display_name ?? 'Prestataire'}</button> <small>{CONTROL[r.profiles?.control_level ?? 0]}</small></> : <small>Proposé par l’équipe KOMYA</small>}</p>
        {r.suspended_at && <p className="error">Cette ressource est suspendue.</p>}
        {!access && !r.suspended_at && <button onClick={() => void activate()}>Accéder gratuitement</button>}
        {!owner && <ReportButton userId={userId} targetType="resource" targetId={id} />}
        {(owner || staff) && <button className="secondary" onClick={() => void removeResource()}>Supprimer cette ressource</button>}
      </div>
      {msg && <p role="status">{msg}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {access && content && (
        <div className="card">
          <b>Ton contenu</b>
          {content.body && <p style={{ whiteSpace: 'pre-wrap' }}>{content.body}</p>}
          {content.link_url && <p><a href={content.link_url} target="_blank" rel="noopener noreferrer">Ouvrir le lien d’accès</a></p>}
          {content.file_path && <p><button onClick={() => void openFile()}>Télécharger {content.file_name ?? 'le fichier'}</button></p>}
          {!content.body && !content.link_url && !content.file_path && <p><small>Le prestataire te contactera selon les modalités indiquées.</small></p>}
        </div>
      )}
      {access && !owner && elig && (elig.allowed ? (
        <form className="card" onSubmit={e => void review(e)}>
          <b>Donner mon avis</b>
          <select aria-label="Note" value={rating} onChange={e => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5 - n)} {n}/5</option>)}</select>
          <textarea aria-label="Commentaire" placeholder="Qualité, conformité à la description, utilité pour ton entreprise…" maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} />
          <button>Publier mon avis</button>
        </form>
      ) : elig.reason && <p><small>{elig.reason}.</small></p>)}
      <h3>Avis</h3>
      {reviews.length === 0 && <p>Pas encore d’avis. Seuls les membres ayant réellement accédé à la ressource peuvent en laisser.</p>}
      {reviews.map(v => <div className="card" key={v.id}><b>{'★'.repeat(v.rating)}</b> <small>{v.profiles?.display_name ?? 'Membre'}, {new Date(v.created_at).toLocaleDateString('fr-FR')}</small>{v.comment && <p>{v.comment}</p>}</div>)}
    </>
  );
}
