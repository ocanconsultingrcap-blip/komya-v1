export const fcfa = (n: number | null | undefined, cur = 'XOF') =>
  n === null || n === undefined ? '' : n === 0 ? 'Gratuit' : `${new Intl.NumberFormat('fr-FR').format(n)} ${cur === 'XOF' ? 'FCFA' : cur}`;
export const CONTROL = ['Aucun contrôle', 'Profil examiné', 'Références vérifiées', 'Prestataire vérifié par KOMYA'];
export const KINDS: Record<string, string> = { formation: 'Formation', coaching: 'Coaching', conseil: 'Conseil', outil: 'Outil numérique', fichier: 'Fichier ou modèle', guide: 'Guide pratique', service: 'Service professionnel', autre: 'Autre' };
export const DELIVERY: Record<string, string> = { download: 'Fichier à télécharger', link: 'Lien d’accès', text: 'Contenu à lire dans KOMYA', session: 'Séances avec le prestataire', manual: 'Livraison convenue avec le prestataire' };
export const RES_CATS = ['Gestion d’entreprise', 'Finances et comptabilité', 'Ventes et marketing', 'Production et qualité', 'Numérique et outils', 'Juridique et administratif', 'Développement personnel', 'Autre'];
export const POST_CATS = ['Questions et entraide', 'Expériences entrepreneuriales', 'Réussites et difficultés', 'Opportunités et partenariats', 'Conseils et pratiques', 'Présentation d’activité'];
export const GROUP_CATS = ['Commerce', 'Agro-transformation', 'Couture et habillement', 'Restauration', 'Transport et mobilité', 'Services aux entreprises', 'Numérique et tech', 'Autre'];
export const INTRO_CTXS = ['Je veux ton avis sur mon prix', 'On est dans le même secteur', 'Question sur ta publication', 'Proposition de partenariat'];
export const BADGES: Record<string, string> = { team: 'Équipe KOMYA', builder: 'Bâtisseur', actor: 'Acteur', inspiring: 'Inspirant', contributor: 'Contributeur', cash: 'Caisse tenue', useful: 'Partage utile', present: 'Répond présent', price: 'Prix clair' };
export const stars = (n: number | null | undefined) => (n ? `★ ${String(n).replace('.', ',')}` : 'Pas encore noté');
