#!/usr/bin/env bash
# Reimporta SÓ o workflow prspAgenteProsp1 (inativo). Aborta se o JSON tiver outro ID.
set -euo pipefail
cd "$(dirname "$0")"
node -e "const w=require('./dist/novax-agente-prospeccao.json'); if(w.id!=='prspAgenteProsp1'){console.error('ID inesperado');process.exit(1)}"
SSH="ssh -i $HOME/.ssh/novax_vps -o BatchMode=yes root@2.25.243.113"
scp -i "$HOME/.ssh/novax_vps" -q dist/novax-agente-prospeccao.json root@2.25.243.113:/tmp/prsp_wf.json
$SSH 'docker cp /tmp/prsp_wf.json novax-n8n:/tmp/prsp_wf.json && rm -f /tmp/prsp_wf.json &&
      docker exec novax-n8n n8n import:workflow --input=/tmp/prsp_wf.json 2>&1 | tail -1;
      docker exec -u root novax-n8n rm -f /tmp/prsp_wf.json;
      docker exec novax-n8n n8n list:workflow --active=true 2>/dev/null | sed "s/^/ativo: /"'
