# Architecture KOMYA

Frontend React + TypeScript + Vite, Supabase Auth + PostgreSQL + Storage + Realtime, Netlify pour l'hébergement. Le navigateur utilise uniquement la clé publique Supabase.

Tables : profiles, user_roles, posts, comments, reactions, networks, network_members, network_posts, challenges, challenge_participants, offers, offer_validations, conversations, conversation_members, messages, blocks, resources, resource_favorites, notifications, announcements, reports, audit_events.

Les rôles privilégiés sont séparés des profils et ne sont jamais auto-attribuables. RLS doit protéger chaque table. Les réseaux privés sont réservés aux membres actifs. Les messages sont accessibles uniquement aux participants. Les opérations sensibles (création atomique de conversations, approbation des défis, gestion des rôles) doivent passer par RPC ou serveur contrôlé.

Buckets envisagés : avatars, post-media, offer-media, resource-files ; politiques Storage alignées sur la visibilité des données. Indexer les clés étrangères et colonnes de filtre, paginer côté serveur.
