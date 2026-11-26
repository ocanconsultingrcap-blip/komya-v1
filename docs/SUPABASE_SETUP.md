# Mise en place Supabase (nouveau projet de production)

1. Créer un nouveau projet Supabase (l'ancien reste l'environnement de test).
2. SQL Editor : exécuter `supabase/migrations/0001_komya_v1.sql`, puis `0002_komya_security.sql` (dans cet ordre, une seule fois).
3. Authentication > URL Configuration : Site URL = URL Netlify ; Redirect URLs = URL Netlify + `/` (pour la réinitialisation du mot de passe).
4. Premier administrateur (SQL Editor, jamais par inscription publique) : créer d'abord le compte via l'application, puis
   `insert into public.user_roles(user_id,role) select id,'admin' from auth.users where email='VOTRE_EMAIL';`
5. Netlify : variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (clé publique uniquement).
6. Ne jamais mettre `service_role` / `sb_secret` dans le navigateur ni dans Netlify côté client.
