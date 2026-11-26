#!/usr/bin/env bash
# Reconstruit le projet KOMYA v1. (v2 - relance déploiement Netlify)
# Accepte : les fichiers sources en vrac (.md, .b64.txt), un zip à la racine,
# et un fichier de corrections optionnel (KOMYA_6_fichiers_corriges.md).
set -e
cd "$(dirname "$0")/.." 2>/dev/null || cd "$(dirname "$0")"

echo "== 0/6 Décompression du zip (si présent) =="
ZIP="$(ls *.zip 2>/dev/null | head -1 || true)"
if [ -n "$ZIP" ]; then
  echo "Zip trouvé : $ZIP"
  rm -rf _zip && mkdir -p _zip
  unzip -o -q "$ZIP" -d _zip
  PKG="$(find _zip -maxdepth 4 -name package.json 2>/dev/null | head -1)"
  if [ -n "$PKG" ]; then
    SRC="$(dirname "$PKG")"
    echo "Projet complet trouvé dans le zip : copie depuis $SRC"
    cp -a "$SRC"/. .
  else
    echo "Fichiers sources trouvés dans le zip : copie vers la racine"
    cp -a _zip/. .
  fi
  rm -rf _zip
else
  echo "Pas de zip : utilisation des fichiers déjà présents."
fi

MD1="KOMYA_etape_K_1_application.md"
MD2="KOMYA_etape_K_2_supabase_et_docs.md"
MD3="KOMYA_6_fichiers_corriges.md"
SRCS="$MD1 $MD2"
[ -f "$MD3" ] && SRCS="$SRCS $MD3" && echo "Corrections détectées : $MD3"

echo "== 1/6 Extraction des fichiers texte =="
if [ -f "$MD1" ] && [ -f "$MD2" ]; then
  awk '
    /^===== FICHIER : .+ =====$/ {
      path = $0
      sub(/^===== FICHIER : /, "", path)
      sub(/ =====$/, "", path)
      dir = path
      sub(/\/[^\/]*$/, "", dir)
      if (dir != path && dir != "") print dir
    }
  ' $SRCS | sort -u | while IFS= read -r d; do mkdir -p "$d"; done

  # Un processus awk par fichier source : le dernier extrait écrase les précédents.
  for src in $SRCS; do
    awk '
      /^===== FICHIER : .+ =====$/ {
        path = $0
        sub(/^===== FICHIER : /, "", path)
        sub(/ =====$/, "", path)
        if (out != "") close(out)
        out = path
        infence = 0
        next
      }
      out != "" {
        if (infence == 0) {
          if ($0 ~ /^```/) { infence = 1 }
          else { print > out }
          next
        }
        if ($0 ~ /^```$/) { close(out); out = ""; infence = 0; next }
        print > out
      }
      END { if (out != "") close(out) }
    ' "$src"
  done
  echo "Extraction OK"
else
  echo "Fichiers .md absents : étape ignorée (projet déjà extrait ?)"
fi

echo "== 1b/6 Corrections des requêtes profils (indices FK) =="
if [ -f src/components/Feed.tsx ]; then
  sed -i "s|category,profiles(|category,profiles!posts_author_id_fkey(|g" src/components/Feed.tsx src/components/NetworkView.tsx
  sed -i "s|expires_at,profiles(|expires_at,profiles!resources_created_by_fkey(|g" src/components/Resources.tsx src/components/ResourceDetail.tsx
  sed -i "s|created_at,profiles(|created_at,profiles!resource_reviews_author_id_fkey(|g" src/components/ResourceDetail.tsx
  sed -i "s|created_by),profiles(|created_by),profiles!resource_reviews_author_id_fkey(|g" src/components/ProviderSpace.tsx
  sed -i "s|created_by,profiles(|created_by,profiles!challenges_created_by_fkey(|g" src/components/Challenges.tsx
  echo "Corrections FK OK"
else
  echo "src/components/Feed.tsx absent : corrections ignorées"
fi

echo "== 2/6 Icônes PWA =="
if [ -f favicon.b64.txt ] && [ -f icon-maskable-512.b64.txt ]; then
  mkdir -p public/icons
  base64 -d favicon.b64.txt            > public/favicon.png
  base64 -d icon-192.b64.txt           > public/icons/icon-192.png
  base64 -d icon-512.b64.txt           > public/icons/icon-512.png
  base64 -d icon-maskable-512.b64.txt  > public/icons/icon-maskable-512.png
  echo "Icônes OK"
else
  echo "Fichiers .b64 absents : étape ignorée"
fi

echo "== 3/6 Logos intégrés (src/logos.ts) =="
if [ -f logo-full.b64.txt ] && [ -f logo-icon.b64.txt ]; then
  FULL=$(tr -d ' \n\r' < logo-full.b64.txt)
  ICON=$(tr -d ' \n\r' < logo-icon.b64.txt)
  {
    echo "// Logos KOMYA intégrés en data-URI (généré automatiquement, ne pas modifier à la main)."
    printf "export const logoFull = 'data:image/png;base64,%s';\n" "$FULL"
    printf "export const logoIcon = 'data:image/png;base64,%s';\n" "$ICON"
  } > src/logos.ts
  echo "logos.ts OK"
else
  echo "Logos b64 absents : étape ignorée"
fi

echo "== 4/6 Remplacement des imports de logos =="
if [ -f src/App.tsx ]; then
  sed -i "s|import logoFull from './logo-full.png';|import { logoFull } from './logos';|" src/App.tsx
  sed -i "s|import logoIcon from '../logo-icon.png';|import { logoIcon } from '../logos';|" src/components/AuthScreen.tsx
  rm -f src/logo-full.png src/logo-icon.png
  echo "Imports OK"
fi

echo "== 5/6 Script prebuild =="
if [ -f package.json ]; then
  mkdir -p scripts
  cat > scripts/decode-images.mjs << 'EOJS'
// Icônes PWA : déjà générées et commitées dans public/.
// Si le dossier assets-base64/ existe, régénère les images ; sinon, rien à faire.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

if (!existsSync('assets-base64')) {
  console.log('assets-base64/ absent : icônes déjà présentes dans public/, rien à faire.');
  process.exit(0);
}
const cibles = {
  'favicon': 'public/favicon.png',
  'icon-192': 'public/icons/icon-192.png',
  'icon-512': 'public/icons/icon-512.png',
  'icon-maskable-512': 'public/icons/icon-maskable-512.png',
};
mkdirSync('public/icons', { recursive: true });
for (const [nom, sortie] of Object.entries(cibles)) {
  const b64 = readFileSync(`assets-base64/${nom}.b64.txt`, 'utf8').trim();
  writeFileSync(sortie, Buffer.from(b64, 'base64'));
  console.log('OK', sortie);
}
EOJS
  sed -i 's|"build":"tsc -b && vite build"|"prebuild":"node scripts/decode-images.mjs","build":"tsc -b \&\& vite build"|' package.json
  node scripts/decode-images.mjs || true
  echo "prebuild OK"
fi

echo "== 6/6 Vérifications =="
ERREUR=0
for f in package.json index.html vite.config.ts src/main.tsx src/App.tsx src/logos.ts public/favicon.png public/icons/icon-512.png scripts/decode-images.mjs; do
  if [ -f "$f" ]; then echo "OK  $f"; else echo "MANQUANT  $f"; ERREUR=1; fi
done
grep -q "from './logos'" src/App.tsx 2>/dev/null && echo "OK  import App.tsx" || { echo "PROBLEME import App.tsx"; ERREUR=1; }
[ -f src/components/Feed.tsx ] && grep -q "posts_author_id_fkey" src/components/Feed.tsx && echo "OK  corrections FK" || { echo "PROBLEME corrections FK (Feed.tsx)"; ERREUR=1; }
if [ "$ERREUR" = "1" ]; then echo "ECHEC : des fichiers manquent."; exit 1; fi
echo "Reconstruction terminée avec succès."
