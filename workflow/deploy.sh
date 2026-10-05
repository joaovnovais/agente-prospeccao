#!/usr/bin/env bash
# Reimporta SÓ o workflow prspAgenteProsp1 (Robson) e o mantém ATIVO/publicado. Aborta se o JSON tiver outro ID.
# Nunca toca na Claudia (6NJ7fIsgaBsWh1iX) e nunca reinicia o container novax-n8n.
# Auditoria 2026-10-05: o deploy do f9b43bd importou um /tmp/prsp_wf.json de 02/10 que ficou na VPS. Agora:
#  - arquivo temporário com nome único (hash) e sha256 conferido no host e no container antes do import;
#  - depois do import, exporta o workflow do banco e confere o BUILD_ID que o build.mjs embute nos Code nodes.
set -euo pipefail
cd "$(dirname "$0")"
JSON=dist/novax-agente-prospeccao.json
node -e "const w=require('./$JSON'); if(w.id!=='prspAgenteProsp1'){console.error('ID inesperado');process.exit(1)}"
BUILD_ID=$(node -e "process.stdout.write((require('./$JSON').meta||{}).buildId||'')")
[ -n "$BUILD_ID" ] || { echo "dist sem meta.buildId — rode: node build.mjs"; exit 1; }
git diff --quiet HEAD -- . || echo "⚠ workflow/ tem mudanças não commitadas: este deploy não corresponde a um commit."
SHA=$(sha256sum "$JSON" | cut -c1-64)
TMP="/tmp/prsp_wf_${SHA:0:12}.json"
KEY="$HOME/.ssh/novax_vps"; HOST=root@2.25.243.113
scp -i "$KEY" -q "$JSON" "$HOST:$TMP"
ssh -i "$KEY" -o BatchMode=yes "$HOST" "set -e
  echo '$SHA  $TMP' | sha256sum -c --quiet
  docker cp $TMP novax-n8n:$TMP && rm -f $TMP
  [ \"\$(docker exec novax-n8n sha256sum $TMP | cut -c1-64)\" = '$SHA' ] || { echo 'hash no container não confere'; exit 1; }
  docker exec novax-n8n n8n import:workflow --input=$TMP 2>&1 | tail -1
  docker exec -u root novax-n8n rm -f $TMP
  docker exec novax-n8n n8n publish:workflow --id=prspAgenteProsp1 2>&1 | grep -i '^Publishing' || true
  docker exec novax-n8n n8n export:workflow --id=prspAgenteProsp1 --output=/tmp/prsp_check.json >/dev/null 2>&1
  if docker exec novax-n8n grep -q 'build: $BUILD_ID' /tmp/prsp_check.json; then echo 'banco = build $BUILD_ID ✔'
  else echo '✘ a versão no banco NÃO é o build $BUILD_ID — não faça Publish'; docker exec -u root novax-n8n rm -f /tmp/prsp_check.json; exit 1; fi
  docker exec -u root novax-n8n rm -f /tmp/prsp_check.json
  docker exec novax-n8n n8n list:workflow --active=true 2>/dev/null | sed 's/^/ativo: /'"
cat <<AVISO

⚠ A CLI só grava no banco: a instância do n8n em execução continua com a versão anterior do Robson.
  1. Recarregue (F5) a aba https://hooks.novax.ia.br/workflow/prspAgenteProsp1 — aba antiga executa/publica versão antiga.
  2. Faça Unpublish → Publish (sem reiniciar o container: a Claudia roda nele).
  3. Na próxima execução, confira em qualquer Code node o comentário "build: $BUILD_ID".
AVISO
