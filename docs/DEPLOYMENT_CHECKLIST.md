# Checklist de déploiement KOMYA

- [ ] Générer et auditer le projet avec Vibe/Claude.
- [ ] Utiliser idéalement un projet Supabase de production distinct du prototype.
- [ ] Sauvegarder la base avant toute migration et examiner les tables/policies existantes.
- [ ] Configurer Auth : Site URL et Redirect URLs Netlify.
- [ ] Configurer Storage et ses politiques.
- [ ] Créer le premier administrateur via une procédure sécurisée, jamais par inscription publique.
- [ ] Tester les accès RLS avec plusieurs comptes, notamment un outsider à un réseau privé.
- [ ] Netlify : `npm run build`, dossier `dist`, variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.
- [ ] HTTPS, domaine, politique de confidentialité, conditions d'utilisation, sauvegardes et support.
- [ ] Tester inscription, récupération, fil, réseaux, défis, offres, validations, messages, notifications et administration sur Android.
