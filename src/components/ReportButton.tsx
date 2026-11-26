import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';

const REASONS = ['Fraude', 'Fausse compétence ou expérience', 'Prestation non conforme', 'Absence de prestation après paiement', 'Comportement inapproprié', 'Contenu trompeur', 'Abus de la plateforme', 'Autre motif'];

export default function ReportButton({ userId, targetType, targetId }: { userId: string; targetType: string; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [evidence, setEvidence] = useState('');
  const [msg, setMsg] = useState('');

  async function send() {
    if (evidence.trim() && !/^https:\/\//i.test(evidence.trim())) { setMsg('Le lien de preuve doit commencer par https://'); return; }
    const { error } = await supabase.from('reports').insert({
      reporter_id: userId, target_type: targetType, target_id: targetId, reason, details: details.trim() || null, evidence_url: evidence.trim() || null,
    });
    if (error) { setMsg(frError(error)); return; }
    setOpen(false); setMsg('Signalement envoyé. L’équipe examinera le dossier : aucune sanction n’est automatique.');
  }

  if (msg && !open) return <small role="status">{msg}</small>;
  if (!open) return <button className="secondary" onClick={() => setOpen(true)}>Signaler</button>;
  return (
    <div className="card">
      <b>Signaler</b>
      <select aria-label="Motif" value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(r => <option key={r}>{r}</option>)}</select>
      <textarea aria-label="Explication" placeholder="Explique ce qui s’est passé (facultatif)" maxLength={2000} value={details} onChange={e => setDetails(e.target.value)} />
      <input aria-label="Lien de preuve" placeholder="Lien de preuve (https://…, facultatif)" value={evidence} onChange={e => setEvidence(e.target.value)} />
      {msg && <p className="error" role="alert">{msg}</p>}
      <div className="row"><button onClick={() => void send()}>Envoyer</button><button className="secondary" onClick={() => setOpen(false)}>Annuler</button></div>
    </div>
  );
}
