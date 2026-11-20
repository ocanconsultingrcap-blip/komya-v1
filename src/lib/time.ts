export function remaining(until: string, now = Date.now()): { text: string; urgent: boolean; over: boolean } {
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return { text: 'Expirée', urgent: true, over: true };
  const min = Math.floor(ms / 60000), h = Math.floor(min / 60), d = Math.floor(h / 24);
  const text = d >= 1 ? `${d} j ${h % 24} h` : h >= 1 ? `${h} h ${min % 60} min` : `${Math.max(1, min)} min`;
  return { text: `Disparaît dans ${text}`, urgent: ms < 3600000, over: false };
}
