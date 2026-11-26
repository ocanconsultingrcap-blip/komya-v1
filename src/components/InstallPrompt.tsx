import { useEffect, useState } from 'react';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [hidden, setHidden] = useState(false);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  if (standalone || hidden || (!evt && !ios)) return null;
  return (
    <div className="card">
      <b>Installer KOMYA sur votre téléphone</b>
      {evt
        ? <p><button onClick={() => void evt.prompt().then(() => setEvt(null))}>Installer l’application</button></p>
        : <p><small>Sur iPhone : touchez Partager puis « Sur l’écran d’accueil ».</small></p>}
      <button className="secondary" onClick={() => setHidden(true)}>Plus tard</button>
    </div>
  );
}
