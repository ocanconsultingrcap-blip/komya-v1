import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { callFn } from './lib/functions';
import { logoFull } from './logos';
import AuthScreen from './components/AuthScreen';
import Feed from './components/Feed';
import Reseau from './components/Reseau';
import Challenges from './components/Challenges';
import Resources from './components/Resources';
import Messages from './components/Messages';
import Notifications from './components/Notifications';
import Admin from './components/Admin';
import ProfileForm from './components/ProfileForm';
import Share from './components/Share';
import InstallPrompt from './components/InstallPrompt';

type Tab = 'home' | 'network' | 'challenges' | 'resources' | 'messages' | 'notifications' | 'profile' | 'admin';
const TABS: [Tab, string, string][] = [['home', '🏠', 'Accueil'], ['network', '👥', 'Réseau'], ['challenges', '🎯', 'Défis'], ['resources', '📚', 'Ressources'], ['messages', '💬', 'Message']];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [roles, setRoles] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [startOn, setStartOn] = useState<'provider' | null>(null);
  const uid = session?.user.id;

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!uid) return;
    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('read_at', null);
    setUnread(count ?? 0);
  }, [uid]);

  useEffect(() => {
    if (!uid) { setRoles([]); setUnread(0); return; }
    void supabase.from('user_roles').select('role').eq('user_id', uid).then(({ data }) => setRoles((data ?? []).map(r => r.role as string)));
    void refreshUnread();
    const ch = supabase.channel(`notif-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => void refreshUnread())
      .subscribe();
    void supabase.rpc('komya_mark_delivered');
    const inbox = supabase.channel(`inbox-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => { if ((payload.new as { sender_id?: string }).sender_id !== uid) void supabase.rpc('komya_mark_delivered'); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); void supabase.removeChannel(inbox); };
  }, [uid, refreshUnread]);

  const clearResource = useCallback(() => { setResourceId(null); setStartOn(null); }, []);
  const openResource = useCallback((id: string) => { setResourceId(id); setTab('resources'); }, []);

  async function deleteAccount() {
    if (!window.confirm('Supprimer définitivement ton compte KOMYA ? Tes publications, commentaires et participations seront perdus. Cette action est irréversible.')) return;
    if (!window.confirm('Dernière confirmation : tu ne pourras plus te connecter avec cet e-mail. Supprimer ?')) return;
    const m = await callFn('delete-account', {});
    if (m) { window.alert('Suppression impossible pour le moment : ' + m); return; }
    await supabase.auth.signOut();
  }

  if (!ready) return <main className="auth"><p>Chargement…</p></main>;
  if (!session || recovery || !uid) return <AuthScreen recovery={recovery} onDone={() => setRecovery(false)} />;

  const staff = roles.length > 0;
  return (
    <>
      <header>
        <img src={logoFull} alt="KOMYA" className="logo" />
        <nav>
          <button className="secondary" aria-label="Notifications" onClick={() => setTab('notifications')}>🔔{unread > 0 ? ` ${unread}` : ''}</button>
          {staff && <button className="secondary" aria-label="Administration" onClick={() => setTab('admin')}>⚙️</button>}
          <button className="secondary" aria-label="Profil" onClick={() => setTab('profile')}>👤</button>
        </nav>
      </header>
      <main className="main">
        <InstallPrompt />
        {tab === 'home' && <Feed userId={uid} staff={staff} />}
        {tab === 'network' && <Reseau userId={uid} onOpenResource={openResource} />}
        {tab === 'challenges' && <Challenges userId={uid} />}
        {tab === 'resources' && <Resources userId={uid} initialResource={resourceId} startOn={startOn} onClearInitial={clearResource} />}
        {tab === 'messages' && <Messages userId={uid} />}
        {tab === 'notifications' && <Notifications userId={uid} onChange={() => void refreshUnread()} />}
        {tab === 'admin' && staff && <Admin isAdmin={roles.includes('admin')} />}
        {tab === 'profile' && (
          <>
            <ProfileForm userId={uid} />
            <div className="card">
              <b>🏪 Espace prestataire</b>
              <p><small>Publie tes formations, outils ou services, et suis les accès, les avis et les signalements.</small></p>
              <button onClick={() => { setStartOn('provider'); setTab('resources'); }}>Ouvrir mon espace prestataire</button>
            </div>
            <Share userId={uid} />
            <button className="secondary" onClick={() => void supabase.auth.signOut()}>Se déconnecter</button>
            <button className="secondary" onClick={() => void deleteAccount()}>Supprimer mon compte</button>
          </>
        )}
      </main>
      <div className="tabbar">
        {TABS.map(([k, icon, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            <span style={{ fontSize: 20, display: 'block' }}>{icon}</span>{label}
          </button>
        ))}
      </div>
    </>
  );
}
