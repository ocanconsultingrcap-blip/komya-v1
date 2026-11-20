# PROMPT MAÎTRE POUR VIBE OU CLAUDE — KOMYA V1

Agis comme un ingénieur full-stack senior. Inspecte tous les fichiers fournis et transforme ce socle en application KOMYA V1 complète. Ne te limite pas à proposer un plan : modifie réellement le projet.

## Contraintes non négociables
- Conserver React + TypeScript + Vite + Supabase + Netlify sauf raison technique démontrée.
- Ne pas utiliser localStorage comme base métier.
- Aucun mot de passe en clair ni champ password dans profiles. Supabase Auth est l'unique gestionnaire des identifiants.
- Ne jamais exposer service_role, sb_secret ou autre secret dans le navigateur.
- Toutes les données métier doivent être persistées dans Supabase. Pas de fausses interactions.
- Activer et tester RLS sur toutes les tables exposées. Ne jamais faire confiance aux seuls contrôles React.
- Ne pas supprimer des données ou réinitialiser le projet sans accord.
- Exécuter `npm run build`, corriger les erreurs et rapporter honnêtement les tests réellement exécutés.

## Marque
KOMYA — Connecter · Partager · Développer. Palette : bleu nuit #071B49, bleu #0B4AA2, turquoise #18B6C9, vert #20B66A, orange #FF8A00, fond #F4F7FC, texte #142344. Utiliser les fichiers de logo/icône transmis par le propriétaire tels quels, sans redessiner le symbole.

## Priorités
P0 : Auth (inscription, confirmation, connexion, déconnexion, récupération/réinitialisation), profil, fil public, publications texte/image, commentaires, réactions, signalements, pagination.
P1 : réseaux publics/privés avec adhésion/invitation/gestion et fil réservé ; défis avec inscription/progression/soumission/validation ; offres produit/service avec prix/devise/localisation/média/recherche ; validations communautaires structurées ; messagerie privée 1:1 avec historique, lu/non lu, blocage et signalement.
P2 : ressources/favoris, notifications, tableau de bord, administration/modération/statistiques.

## Sécurité obligatoire
- RLS sur chaque table ; tester avec deux membres ordinaires, un non-membre d'un réseau privé, un modérateur et un administrateur.
- Un utilisateur ne peut pas s'attribuer de rôle privilégié.
- Un non-membre ne peut ni lire les membres ni le contenu d'un réseau privé.
- Un non-participant ne peut pas lire une conversation ou ses messages. Les participants ne peuvent pas ajouter arbitrairement un tiers.
- Un participant ne peut pas s'auto-approuver un défi. Limiter les colonnes modifiables ou utiliser RPC.
- Protéger les uploads selon type MIME, taille, propriétaire et visibilité.
- Ne pas exposer les coordonnées privées des profils.

## UX et performance
Mobile-first, Android, largeur 360px, PWA, faible débit, images compressées, pagination serveur, labels et contrastes accessibles, états d'erreur/chargement/vides, interface française et contexte panafricain.

## Étapes d'exécution
A. Audit du code et schéma. B. Auth/profil. C. Communauté. D. Réseaux. E. Défis. F. Offres/validations. G. Messagerie. H. Ressources/notifications/dashboard. I. Administration et sécurité. J. Tests/build/documentation.

Après chaque étape, liste les fichiers modifiés, les tests exécutés et les limites restantes. À la fin, fournis : application complète, migrations SQL, .env.example, guide Supabase/Netlify, scénarios de tests, résultat réel du build, liste achevé/incomplet/non testé. Aucun compte admin ou utilisateur de démonstration codé en dur en production.
