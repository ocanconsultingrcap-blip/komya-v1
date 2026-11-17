# KOMYA V1 — kit de départ

Socle React/TypeScript/Vite + Supabase : authentification, publication et fil public minimaux. Ce n'est PAS encore l'application complète. Les autres modules doivent être construits par Vibe/Claude selon `docs/INSTRUCTIONS_GENERATION.md`.

## Démarrage
1. Installer Node.js LTS.
2. Copier `.env.example` vers `.env.local` et renseigner l'URL Supabase et la clé publique (publishable/anon). Jamais de `service_role` ou `sb_secret` dans le navigateur.
3. `npm install`, puis `npm run dev`.
4. `npm run build` pour vérifier la compilation.

Avant toute migration sur une base existante : sauvegarder et examiner les objets présents. Préférer un projet Supabase de production distinct du prototype.
