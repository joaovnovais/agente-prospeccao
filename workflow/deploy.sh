#!/usr/bin/env bash
# Reimporta SÓ o workflow do alvo (Robson prspAgenteProsp1 ou watchdog prspWatchdog01) e o mantém ATIVO/publicado. Aborta se o JSON tiver outro ID.
# Nunca toca na Claudia (6NJ7fIsgaBsWh1iX) e nunca reinicia o container novax-n8n.
# Auditoria 2026-10-05: o deploy do f9b43bd importou um /tmp/prsp_wf.json de 02/10 que ficou na VPS. Agora:
#  - arquivo temporário com nome único (hash) e sha256 conferido no host e no container antes do import;
#  - depois do import, exporta o workflow do banco e confere o BUILD_ID que o build.mjs embute nos Code nodes.
set -euo pipefail
cd "$(dirname "$0")"
# Alvo: robson (padrão) ou watchdog. Lista fechada de IDs permitidos; o da Claudia é sempre recusado.
case "${1:-robson}" in
  robson)   JSON=dist/novax-agente-prospeccao.json; WFID=prspAgenteProsp1 ;;
  watchdog) JSON=dist/novax-robson-watchdog.json;   WFID=prspWatchdog01 ;;
  *) echo "alvo inválido: use robson ou watchdog"; exit 1 ;;
esac
node -e "const w=require('./$JSON'); if(w.id!=='$WFID' || w.id==='6NJ7fIsgaBsWh1iX'){console.error('ID inesperado: '+w.id);process.exit(1)}"
# 21/10 (regras do João): nunca entre 06:30 e 10:30 (BRT) em dia útil; no máximo um deploy por dia. Robson + watchdog do
# mesmo pacote contam como um só: passe PACOTE=<nome> (ex.: PACOTE=pacote-1310). O registro fica em docs/local (gitignored).
HM=$(date -u -d '-3 hours' +%H%M); DOW=$(date -u -d '-3 hours' +%u); HOJE=$(date -u -d '-3 hours' +%F)
if [ "$DOW" -le 5 ] && [ "$HM" -ge 0630 ] && [ "$HM" -lt 1030 ]; then echo "✘ janela proibida (06:30–10:30 BRT em dia útil): deploy recusado"; exit 1; fi
LOG=../docs/local/deploys.log; PACOTE="${PACOTE:-$WFID}"
if [ -f "$LOG" ] && grep "^$HOJE " "$LOG" | grep -vq " $PACOTE "; then
  echo "✘ já houve outro deploy hoje ($(grep "^$HOJE " "$LOG" | awk '{print $2}' | sort -u | tr '\n' ' ')): um por dia. Use o mesmo PACOTE= se for parte dele."; exit 1; fi
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
  docker exec novax-n8n n8n publish:workflow --id=$WFID 2>&1 | grep -i '^Publishing' || true
  docker exec novax-n8n n8n export:workflow --id=$WFID --output=/tmp/prsp_check.json >/dev/null 2>&1
  if docker exec novax-n8n grep -q 'build: $BUILD_ID' /tmp/prsp_check.json; then echo 'banco = build $BUILD_ID ✔'
  else echo '✘ a versão no banco NÃO é o build $BUILD_ID — não faça Publish'; docker exec -u root novax-n8n rm -f /tmp/prsp_check.json; exit 1; fi
  docker exec -u root novax-n8n rm -f /tmp/prsp_check.json
  docker exec novax-n8n n8n list:workflow --active=true 2>/dev/null | sed 's/^/ativo: /'"
echo "$HOJE $PACOTE $WFID $BUILD_ID $(date -u -d '-3 hours' +%H:%M)" >> "$LOG"
# 21/10: Publish pela API pública (chave "Robson deploy"), com conferência no histórico de publicação e no build da versão
# ativa. Se a API não confirmar, cai no Publish manual (código 2 = a cadeia automática para e pede ao João).
if node publicar-api.mjs "$WFID" "$BUILD_ID"; then
  echo "✔ $WFID publicado pela API. Na próxima execução, confira \"build: $BUILD_ID\" e o workflowVersionId."
else
cat <<AVISO

⚠ O Publish pela API não confirmou: a instância do n8n em execução continua com a versão anterior de $WFID.
  1. Recarregue (F5) a aba https://hooks.novax.ia.br/workflow/$WFID — aba antiga executa/publica versão antiga.
  2. Faça Unpublish → Publish (sem reiniciar o container: a Claudia roda nele).
  3. Na próxima execução, confira em qualquer Code node o comentário "build: $BUILD_ID".
AVISO
  exit 2
fi
