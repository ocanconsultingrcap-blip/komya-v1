#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.." 2>/dev/null || cd "$(dirname "$0")"

MD1="KOMYA_etape_K_1_application.md"
MD2="KOMYA_etape_K_2_supabase_et_docs.md"

for f in "$MD1" "$MD2" favicon.b64.txt icon-192.b64.txt icon-512.b64.txt icon-maskable-512.b64.txt logo-full.b64.txt logo-icon.b64.txt decode-images.mjs; do
  [ -f "$f" ] || { echo "FICHIER MANQUANT : $f" >&2; exit 1; }
done

echo "== 1/6 Extraction des fichiers texte =="
awk '
  /^===== FICHIER : .+ =====$/ {
    path = $0
    sub(/^===== FICHIER : /, "", path)
    sub(/ =====$/, "", path)
    dir = path
    sub(/\/[^\/]*$/, "", dir)
    if (dir != path && dir != "") print dir
  }
' "$MD1" "$MD2" | sort -u | while IFS= read -r d; do mkdir -p "$d"; done

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
' "$MD1" "$MD2"

echo "== 2/6 Icônes PWA =="
mkdir -p public/icons
base64 -d favicon.b64.txt            > public/favicon.png
base64 -d icon-192.b64.txt           > public/icons/icon-192.png
base64 -d icon-512.b64.txt           > public/icons/icon-512.png
base64 -d icon-maskable-512.b64.txt  > public/icons/icon-maskable-512.png

echo "== 3/6 Logos intégrés (src/logos.ts) =="
FULL=$(tr -d ' \n\r' < logo-full.b64.txt)
ICON=$(tr -d ' \n\r' < logo-icon.b64.txt)
{
  echo "// Logos KOMYA intégrés en data-URI (généré automatiquement, ne pas modifier à la main)."
  printf "export const logoFull = 'data:image/png;base64,%s';\n" "$FULL"
  printf "export const logoIcon = 'data:image/png;base64,%s';\n" "$ICON"
} > src/logos.ts

echo "== 4/6 Remplacement des imports de logos =="
sed -i "s|import logoFull from './logo-full.png';|import { logoFull } from './logos';|" src/App.tsx
sed -i "s|import logoIcon from '../logo-icon.png';|import { logoIcon } from '../logos';|" src/components/AuthScreen.tsx

echo "== 5/6 Script prebuild =="
mkdir -p scripts
mv -f decode-images.mjs scripts/decode-images.mjs
sed -i 's|"build":"tsc -b && vite build"|"prebuild":"node scripts/decode-images.mjs","build":"tsc -b \&\& vite build"|' package.json
rm -f src/logo-full.png src/logo-icon.png

echo "== 6/6 Vérifications =="
[ -f src/logos.ts ] && echo "OK src/logos.ts"
grep -q "prebuild" package.json && echo "OK prebuild dans package.json"
grep -q "from './logos'" src/App.tsx && echo "OK import App.tsx"
grep -q "from '../logos'" src/components/AuthScreen.tsx && echo "OK import AuthScreen.tsx"
[ -f public/icons/icon-512.png ] && echo "OK icônes PWA"
echo "Reconstruction terminée."
