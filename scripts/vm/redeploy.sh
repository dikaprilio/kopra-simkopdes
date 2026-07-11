#!/usr/bin/env bash
# Redeploy Kopra dari tarball CI: /tmp/kopra-deploy.tar.gz
# .env root/apps TIDAK tersentuh (tidak ada di tarball).
set -euo pipefail
cd /home/kopra/app
echo "== extract =="
tar xzf /tmp/kopra-deploy.tar.gz -C /home/kopra/app
echo "== install =="
pnpm install --prefer-offline 2>&1 | tail -2
echo "== prisma generate + db push =="
set -a; source .env; set +a
pnpm --filter @kopra/db generate 2>&1 | tail -1
(cd packages/db && npx prisma db push --skip-generate --accept-data-loss 2>&1 | tail -1)
psql "$DATABASE_URL" -f /home/kopra/app/packages/db/sql/rag_fts.sql >/dev/null && echo "FTS re-applied"
echo "== build =="
pnpm --filter api build 2>&1 | tail -1
pnpm --filter agent build 2>&1 | tail -1
pnpm --filter web build 2>&1 | tail -2
echo "== prisma client -> mastra bundle =="
SRC_JS=$(find /home/kopra/app/node_modules/.pnpm -path "*@prisma+client*/.prisma/client/default.js" 2>/dev/null | head -1 || true)
DST_JS=$(find /home/kopra/app/apps/agent/.mastra/output/node_modules/.pnpm -path "*@prisma+client*/node_modules/.prisma/client/default.js" 2>/dev/null | head -1 || true)
if [ -z "$SRC_JS" ] || [ -z "$DST_JS" ]; then
  echo "FATAL: path prisma client tidak ketemu (SRC_JS='$SRC_JS' DST_JS='$DST_JS')"; exit 1
fi
SRC=$(dirname "$SRC_JS")
DST=$(dirname "$DST_JS")
cp -r "$SRC/." "$DST/"
echo "== restart =="
pm2 restart api agent web --update-env
sleep 6
pm2 status | grep -E "api|agent|web|gowa"
curl -sf -o /dev/null "http://localhost:3001/api/v1/registration/koperasi?q=a" && echo "API HEALTH OK"
curl -sf -o /dev/null http://localhost:3000/login && echo "WEB HEALTH OK"
rm -f /tmp/kopra-deploy.tar.gz
echo "REDEPLOY SELESAI"
