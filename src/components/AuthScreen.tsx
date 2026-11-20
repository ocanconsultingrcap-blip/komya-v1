import type { FormEvent } from 'react';
import { useState } from 'react';
import { logoIcon } from '../logos';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';

type Mode = 'login' | 'signup' | 'forgot';

export default function AuthScreen({ recovery, onDone }: { recovery: boolean; onDone: () => void }) {
  const inviteParam = new URLSearchParams(window.location.search).get('invite') ?? '';
  const [mode, setMode] = useState<Mode>(inviteParam ? 'signup' : 'login');
  const [invite, setInvite] = useState(inviteParam);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setMsg(''); setBusy(true);
    try {
      if (recovery) {
        if (password.length < 8) throw new Error('8 caractères minimum.');
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw err;
        setMsg('Mot de passe mis à jour.'); onDone();
      } else if (mode === 'forgot') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (err) throw err;
        setMsg('Si ce compte existe, un e-mail de réinitialisation a été envoyé.');
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Mot de passe : 8 caractères minimum.');
        const { error: err } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name.trim() || undefined, invite_code: invite.trim() || undefined }, emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        setMsg('Compte créé. Vérifiez votre e-mail pour confirmer votre adresse.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(frError(err));
    } finally { setBusy(false); }
  }

  return (
    <main className="auth">
      <form className="card" onSubmit={e => void submit(e)}>
        <img src={logoIcon} alt="KOMYA" width={72} height={72} />
        <small>CONNECTER · PARTAGER · DÉVELOPPER</small>
        <h1>{recovery ? 'Nouveau mot de passe' : 'Bienvenue sur KOMYA'}</h1>
        {!recovery && mode === 'signup' && (
          <input aria-label="Nom affiché" placeholder="Nom affiché" value={name} maxLength={80} onChange={e => setName(e.target.value)} />
        )}
        {!recovery && mode === 'signup' && (
          <input aria-label="Clé d’invitation" placeholder="Clé d’invitation (facultatif)" value={invite} onChange={e => setInvite(e.target.value)} />
        )}
        {!recovery && (
          <input aria-label="Adresse e-mail" placeholder="Adresse e-mail" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        )}
        {mode !== 'forgot' && (
          <input aria-label="Mot de passe" placeholder="Mot de passe (8 caractères minimum)" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
        )}
        <button disabled={busy}>
          {recovery ? 'Enregistrer' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer un compte' : 'Envoyer le lien'}
        </button>
        {!recovery && (
          <>
            {mode !== 'login' && <button type="button" className="secondary" onClick={() => setMode('login')}>J’ai déjà un compte</button>}
            {mode !== 'signup' && <button type="button" className="secondary" onClick={() => setMode('signup')}>Créer un compte</button>}
            {mode === 'login' && <button type="button" className="secondary" onClick={() => setMode('forgot')}>Mot de passe oublié</button>}
          </>
        )}
        {msg && <p role="status">{msg}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </main>
  );
}
