import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import { DELIVERY, KINDS, RES_CATS, stars } from '../lib/format';
import { MAX_FILE, extOf, mimeOf, prettySize } from '../lib/image';
import { callFn } from '../lib/functions';
import Countdown from './Countdown';

type Dash = { resources_published: number; resources_suspended: number; free_accesses: number; avg_rating: number | null; review_count: number };
type MyRes = { id: string; title: string; kind: string; published: boolean; suspended_at: string | null; expires_at: string | null };
const DURATIONS: [string, string][] = [['', 'Sans limite de temps'], ['1', 'Disparaît après 1 heure'], ['24', 'Disparaît après 24 heures'], ['72', 'Disparaît après 3 jours'], ['168', 'Disparaît après 7 jours'], ['720', 'Disparaît après 30 jours'], ['custom', 'Choisir une date et une heure']];
type Stat = { resource_id: string; avg_rating: number | null; review_count: number; access_count: number };
type Rev = { id: string; rating: number; comment: string | null; created_at: string; resources: { title: string } | null; profiles: { display_name: string } | null };
type Case = { id: string; reason: string; details: string | null; evidence_url: string | null; status: string; provider_response: string | null };
const FILE_EXTS = ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv', 'png', 'jpg', 'jpeg'];

export default function ProviderSpace({ userId }: { userId: string }) {
  const [isProvider, setIsProvider] = useState<boolean | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [mine, setMine] = useState<MyRes[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [reviews, setReviews] = useState<Rev[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [act, setAct] = useState({ expertise: '', experience_text: '', references_text: '' });
  const [f, setF] = useState({ title: '', summary: '', category: RES_CATS[0], kind: 'guide', delivery_mode: 'text', access_conditions: '', duration: '', sessions: '', contact_mode: '', body: '', link_url: '' });
  const [file, setFile] = useState<File | null>(null);
  const [dur, setDur] = useState('');
  const [until, setUntil] = useState('');

  const load = useCallback(async () => {
    const p = await supabase.from('profiles').select('is_provider').eq('id', userId).single();
    if (p.error) { setError(frError(p.error)); return; }
    const prov = !!p.data?.is_provider;
    setIsProvider(prov);
    if (!prov) return;
    const [d, m, rv, n] = await Promise.all([
      supabase.rpc('komya_provider_dashboard'),
      supabase.from('resources').select('id,title,kind,published,suspended_at,expires_at').eq('created_by', userId).order('created_at', { ascending: false }),
      supabase.from('resource_reviews').select('id,rating,comment,created_at,resources!inner(title,created_by),profiles(display_name)').eq('resources.created_by', userId).order('created_at', { ascending: false }).limit(30),
      supabase.from('notifications').select('entity_id').eq('user_id', userId).eq('kind', 'report_explanation').order('created_at', { ascending: false }).limit(10),
    ]);
    setDash((d.data ?? null) as Dash | null);
    const list = (m.data ?? []) as MyRes[];
    setMine(list); setReviews((rv.data ?? []) as unknown as Rev[]);
    if (list.length) {
      const s = await supabase.rpc('komya_resource_stats', { rids: list.map(x => x.id) });
      setStats(Object.fromEntries(((s.data ?? []) as Stat[]).map(x => [x.resource_id, x])));
    }
    const ids = [...new Set((n.data ?? []).map(x => x.entity_id as string).filter(Boolean))];
    const got: Case[] = [];
    for (const id of ids) { const v = await supabase.rpc('komya_report_view_for_provider', { rid: id }); if (!v.error && v.data) got.push(v.data as Case); }
    setCases(got);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  async function activate(e: FormEvent) {
    e.preventDefault();
    const { error: err } = await supabase.from('profiles').update({ is_provider: true, ...act }).eq('id', userId);
    if (err) setError(frError(err)); else { setMsg('Ton espace prestataire est activé. Tu gardes ton compte de membre.'); void load(); }
  }
  function pickFile(list: FileList | null) {
    const x = list?.[0]; setError('');
    if (!x) { setFile(null); return; }
    if (!FILE_EXTS.includes(extOf(x.name))) { setError('Formats acceptés : PDF, Word, Excel, PowerPoint, TXT, CSV, JPG, PNG.'); return; }
    if (x.size > MAX_FILE) { setError(`Ce fichier fait ${prettySize(x.size)} : 1,5 Mo maximum.`); return; }
    setFile(x);
  }
  async function publish(e: FormEvent) {
    e.preventDefault(); setError(''); setMsg('');
    if (f.link_url.trim() && !/^https?:\/\//i.test(f.link_url.trim())) { setError('Le lien doit commencer par http:// ou https://'); return; }
    let expires: string | null = null;
    if (dur === 'custom') {
      const d = new Date(until);
      if (!until || Number.isNaN(d.getTime()) || d.getTime() < Date.now() + 5 * 60000) { setError('Choisis une date et une heure situées au moins 5 minutes dans le futur.'); return; }
      expires = d.toISOString();
    } else if (dur) expires = new Date(Date.now() + Number(dur) * 3600000).toISOString();
    let meta: { file_path: string; file_name: string; file_type: string; file_size: number } | null = null;
    if (file) {
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const up = await supabase.storage.from('resource-files').upload(path, file, { contentType: mimeOf(file.name) ?? file.type });
      if (up.error) { setError(frError(up.error)); return; }
      meta = { file_path: path, file_name: file.name, file_type: file.type, file_size: file.size };
    }
    const { error: err } = await supabase.from('resources').insert({
      created_by: userId, title: f.title.trim(), summary: f.summary.trim() || null, category: f.category, kind: f.kind, delivery_mode: f.delivery_mode,
      access_conditions: f.access_conditions.trim() || null, duration: f.duration.trim() || null, sessions: f.sessions.trim() || null, contact_mode: f.contact_mode.trim() || null,
      body: f.body.trim() || null, link_url: f.link_url.trim() || null, published: true, by_member: true, expires_at: expires, ...(meta ?? {}),
    });
    if (err) setError(frError(err)); else { setMsg(expires ? 'Ressource publiée : elle disparaîtra automatiquement à l’échéance choisie.' : 'Ressource publiée : elle est visible dans le catalogue.'); setFile(null); setDur(''); setUntil(''); setF({ ...f, title: '', summary: '', body: '', link_url: '', access_conditions: '', duration: '', sessions: '', contact_mode: '' }); void load(); }
  }
  async function toggle(r: MyRes) {
    const { error: err } = await supabase.from('resources').update({ published: !r.published }).eq('id', r.id);
    if (err) setError(frError(err)); else void load();
  }
  async function remove(r: MyRes) {
    if (!window.confirm(`Supprimer définitivement « ${r.title} » ? Ses fichiers seront effacés et les membres n’y auront plus accès.`)) return;
    const m = await callFn('delete-resource', { resource_id: r.id });
    if (m) setError(m); else { setMsg('Ressource supprimée.'); void load(); }
  }
  async function answer(id: string) {
    const { error: err } = await supabase.rpc('komya_report_respond', { rid: id, txt: answers[id] ?? '' });
    if (err) setError(frError(err)); else { setMsg('Ta version des faits a été transmise à l’équipe.'); void load(); }
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  if (isProvider === null) return <p>Chargement…</p>;
  if (!isProvider) return (
    <form className="card" onSubmit={e => void activate(e)}>
      <h2>Devenir prestataire</h2>
      <p><small>Publie des formations, outils, fichiers ou services pour la communauté. Aucun document n’est demandé. Tu gardes ton compte de membre.</small></p>
      <input aria-label="Domaine d’expertise" placeholder="Domaine d’expertise" required value={act.expertise} onChange={e => setAct({ ...act, expertise: e.target.value })} />
      <textarea aria-label="Expérience" placeholder="Ton expérience (déclarative)" value={act.experience_text} onChange={e => setAct({ ...act, experience_text: e.target.value })} />
      <textarea aria-label="Références" placeholder="Références (facultatif)" value={act.references_text} onChange={e => setAct({ ...act, references_text: e.target.value })} />
      <button>Activer mon espace prestataire</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
  return (
    <>
      <h2>Mon espace prestataire</h2>
      {msg && <p role="status">{msg}</p>}{error && <p className="error" role="alert">{error}</p>}
      {dash && (
        <div className="card">
          <b>Mon activité</b>
          <p>{dash.resources_published} ressource(s) publiée(s) · {dash.free_accesses} accès au total · {stars(dash.avg_rating)}{dash.review_count ? ` (${dash.review_count} avis)` : ''}</p>
          {dash.resources_suspended > 0 && <p className="error">{dash.resources_suspended} ressource(s) suspendue(s) par la modération.</p>}
        </div>
      )}
      {cases.filter(c => c.status !== 'resolved' && c.status !== 'dismissed').map(c => (
        <div className="card" key={c.id}>
          <b>Un signalement te concerne</b>
          <p><small>Motif : {c.reason}{c.details ? ` · ${c.details}` : ''}</small></p>
          {c.provider_response ? <p><small>Ta réponse : {c.provider_response}</small></p> : <>
            <textarea aria-label="Ta version des faits" placeholder="Explique ta version des faits" value={answers[c.id] ?? ''} onChange={e => setAnswers({ ...answers, [c.id]: e.target.value })} />
            <button disabled={!(answers[c.id] ?? '').trim()} onClick={() => void answer(c.id)}>Envoyer ma réponse</button></>}
        </div>
      ))}
      <form className="card" onSubmit={e => void publish(e)}>
        <b>Publier une ressource</b>
        <input aria-label="Titre" placeholder="Titre" required minLength={3} value={f.title} onChange={set('title')} />
        <textarea aria-label="Description" placeholder="Description visible par tous" value={f.summary} onChange={set('summary')} />
        <select aria-label="Type" value={f.kind} onChange={set('kind')}>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select aria-label="Catégorie" value={f.category} onChange={set('category')}>{RES_CATS.map(c => <option key={c}>{c}</option>)}</select>
        <select aria-label="Mode de livraison" value={f.delivery_mode} onChange={set('delivery_mode')}>{Object.entries(DELIVERY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <textarea aria-label="Contenu réservé" placeholder="Contenu réservé à ceux qui accèdent à la ressource (texte)" value={f.body} onChange={set('body')} />
        <input aria-label="Lien d’accès" placeholder="Lien d’accès réservé (https://…)" value={f.link_url} onChange={set('link_url')} />
        <input aria-label="Fichier" type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,.png,.jpg,.jpeg" onChange={e => pickFile(e.target.files)} />
        <small>Fichier : 1,5 Mo maximum.</small>
        <input aria-label="Conditions d’accès" placeholder="Conditions d’accès" value={f.access_conditions} onChange={set('access_conditions')} />
        {['formation', 'coaching', 'conseil', 'service'].includes(f.kind) && <>
          <input aria-label="Durée" placeholder="Durée" value={f.duration} onChange={set('duration')} />
          <input aria-label="Séances" placeholder="Nombre et contenu des séances" value={f.sessions} onChange={set('sessions')} />
          <input aria-label="Prise de contact" placeholder="Comment te contacter (WhatsApp, appel…)" value={f.contact_mode} onChange={set('contact_mode')} />
        </>}
        <label><small>Durée de visibilité</small>
          <select aria-label="Durée de visibilité" value={dur} onChange={e => setDur(e.target.value)}>{DURATIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        {dur === 'custom' && <input aria-label="Date et heure de fin" type="datetime-local" value={until} onChange={e => setUntil(e.target.value)} />}
        {dur && <small>À l’échéance, la ressource et ses fichiers sont retirés automatiquement.</small>}
        <button>Publier</button>
      </form>
      <h3>Mes ressources</h3>
      {mine.length === 0 && <p>Tu n’as pas encore publié de ressource.</p>}
      {mine.map(r => (
        <div className="card" key={r.id}><b>{r.title}</b> <small className="cat">{KINDS[r.kind] ?? r.kind}</small>
          <p><small>{r.suspended_at ? 'Suspendue par la modération' : r.expires_at && new Date(r.expires_at) < new Date() ? 'Expirée' : r.published ? 'Publiée' : 'Suspendue par toi'} · {stats[r.id]?.access_count ?? 0} accès · {stars(stats[r.id]?.avg_rating)}{stats[r.id]?.review_count ? ` (${stats[r.id].review_count} avis)` : ''}</small></p>
          {r.expires_at && <p><Countdown until={r.expires_at} /></p>}
          <div className="row">
            {!r.suspended_at && !(r.expires_at && new Date(r.expires_at) < new Date()) && <button className="secondary" onClick={() => void toggle(r)}>{r.published ? 'Suspendre' : 'Republier'}</button>}
            <button className="secondary" onClick={() => void remove(r)}>Supprimer</button>
          </div>
        </div>
      ))}
      <h3>Avis reçus</h3>
      {reviews.length === 0 && <p>Aucun avis pour le moment.</p>}
      {reviews.map(v => <div className="card" key={v.id}><b>{'★'.repeat(v.rating)}</b> <small>sur « {v.resources?.title} » par {v.profiles?.display_name ?? 'un membre'}, {new Date(v.created_at).toLocaleDateString('fr-FR')}</small>{v.comment && <p>{v.comment}</p>}</div>)}
    </>
  );
}
