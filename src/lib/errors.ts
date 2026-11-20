// Traduit les messages techniques (Supabase, PostgreSQL, réseau) en phrases simples en français.
const MAP: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-mail ou mot de passe incorrect.'],
  [/email not confirmed/i, 'Ton e-mail n’est pas encore confirmé. Ouvre le message reçu et clique sur le lien.'],
  [/user already registered|already been registered|email address has already|already exists.*email/i, 'Un compte existe déjà avec cet e-mail.'],
  [/password should be at least|weak.?password|password.*(too short|at least)/i, 'Le mot de passe est trop court : 8 caractères minimum.'],
  [/new password should be different/i, 'Choisis un mot de passe différent de l’ancien.'],
  [/invalid format|unable to validate email|valid email/i, 'Cette adresse e-mail n’est pas valide.'],
  [/rate limit|too many requests|security purposes|over_.*rate_limit/i, 'Trop de tentatives. Patiente quelques minutes avant de réessayer.'],
  [/signups? (not allowed|are disabled)/i, 'Les inscriptions sont fermées pour le moment.'],
  [/jwt expired|invalid jwt|refresh token|session.*(missing|expired)|not authenticated|auth session missing/i, 'Ta session a expiré. Reconnecte-toi.'],
  [/failed to fetch|networkerror|network request failed|load failed|fetch failed/i, 'Connexion impossible. Vérifie ton réseau et réessaie.'],
  [/violates row-level security|permission denied|not authorized|unauthorized|forbidden/i, 'Tu n’as pas le droit de faire cette action.'],
  [/komya_posts_body_len|komya_network_posts_body_len/i, 'Le texte doit faire entre 1 et 3 000 caractères.'],
  [/komya_posts_category/i, 'Choisis une catégorie dans la liste.'],
  [/komya_resources_free_only/i, 'Les ressources sont gratuites pour le moment.'],
  [/duplicate key|unique constraint|already exists/i, 'Cette action a déjà été faite.'],
  [/foreign key/i, 'Cet élément n’existe plus.'],
  [/violates check constraint/i, 'Une des informations saisies n’est pas valide. Vérifie le formulaire.'],
  [/null value in column|not-null/i, 'Un champ obligatoire est vide.'],
  [/value too long|too long for type/i, 'Un des textes est trop long.'],
  [/invalid input syntax/i, 'Une des informations saisies n’est pas valide.'],
  [/exceeded the maximum allowed size|payload too large|maximum allowed size/i, 'Fichier trop lourd : 1,5 Mo maximum.'],
  [/mime type|not supported|unsupported/i, 'Ce type de fichier n’est pas autorisé.'],
  [/bucket not found|object not found/i, 'Fichier introuvable.'],
  [/timeout|timed out/i, 'Le serveur met trop de temps à répondre. Réessaie.'],
];
const TECH = /\b(violates|constraint|relation|column|syntax|policy|function|schema|jwt|token|invalid|failed|unauthorized|forbidden|not found|error|exception|undefined|null|cannot|could not|unexpected|denied|duplicate|bucket|postgres|supabase|http|status|request)\b/i;
const ENGLISH = /\b(the|is|are|was|were|not|to|of|for|with|please|try|you|your|must|should|has|have|been)\b/i;

export function frError(e: unknown, fallback = 'Une erreur est survenue. Réessaie dans un instant.'): string {
  const msg = typeof e === 'string' ? e : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message ?? '') : '';
  if (!msg.trim()) return fallback;
  for (const [re, fr] of MAP) if (re.test(msg)) return fr;
  if (TECH.test(msg)) return fallback;
  if (!/[àâçéèêëîïôûùüœ]/i.test(msg) && ENGLISH.test(msg)) return fallback;
  return msg;
}
