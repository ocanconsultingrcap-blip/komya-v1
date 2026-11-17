import { useEffect, useState } from 'react';
import { remaining } from '../lib/time';

export default function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const r = remaining(until, now);
  return <small className="cat" style={r.urgent ? { background: '#fde8e8', color: '#b42318' } : undefined} title={new Date(until).toLocaleString('fr-FR')}>⏳ {r.text}</small>;
}
