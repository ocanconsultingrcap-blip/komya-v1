export default function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  if (url) return <img src={url} alt="" width={size} height={size} loading="lazy" style={{ borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />;
  return <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: '#e8effc', color: '#0b4aa2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.round(size * 0.42), flex: 'none' }}>{(name || 'M').trim()[0]?.toUpperCase()}</span>;
}
