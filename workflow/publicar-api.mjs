// Publish pela API pública do n8n (testado em 21/10 no watchdog: HTTP 200, histórico "activated" na versão importada,
// sem restart). Chamado pelo deploy.sh depois do import. Uso: node publicar-api.mjs <workflowId> <buildId>
// A chave vem de docs/local/.env (N8N_API_KEY, chave "Robson deploy", só workflow:read/activate/deactivate) e nunca é impressa.
// Sai com código 0 só se: (1) a API ativou a versão importada, (2) o último evento do histórico de publicação é "activated"
// nessa versão e (3) essa versão contém o build esperado. Qualquer outra coisa → código ≠ 0 (o deploy.sh pede o Publish manual).
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const [wfid, build] = process.argv.slice(2);
if (!/^prsp[A-Za-z0-9]+$/.test(wfid || '') || wfid === '6NJ7fIsgaBsWh1iX') { console.error('ID inválido (só prsp*; nunca a Claudia)'); process.exit(3); }
const ENV = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', '.env');
const env = existsSync(ENV) ? readFileSync(ENV, 'utf8') : '';
const key = (env.match(/^\s*N8N_API_KEY\s*=\s*"?([^"\s]+)"?\s*$/m) || [])[1];
if (!key) { console.error('sem N8N_API_KEY em docs/local/.env'); process.exit(4); }
const API = 'https://hooks.novax.ia.br/api/v1';
const h = { 'X-N8N-API-KEY': key };
const antes = await (await fetch(`${API}/workflows/${wfid}`, { headers: h })).json().catch(() => ({}));
const versao = antes.versionId;
if (!versao) { console.error('não consegui ler a versão importada pela API'); process.exit(5); }
const r = await fetch(`${API}/workflows/${wfid}/activate`, { method: 'POST', headers: h });
const j = await r.json().catch(() => ({}));
if (r.status !== 200 || j.active !== true || (j.activeVersionId && j.activeVersionId !== versao)) {
  console.error(`API recusou ou ativou outra versão: HTTP ${r.status} active=${j.active} ativa=${j.activeVersionId} esperada=${versao} ${j.message || ''}`); process.exit(6);
}
// Conferência independente no banco do n8n (somente leitura): último evento do histórico e build da versão ativa.
const KEY = `${process.env.HOME || process.env.USERPROFILE}/.ssh/novax_vps`;
const py = `import sqlite3,re
c=sqlite3.connect('file:/var/lib/docker/volumes/novax-vps-n8n_n8n_data/_data/database.sqlite?mode=ro',uri=True)
ev=c.execute("select event,versionId from workflow_publish_history where workflowId=? order by createdAt desc limit 1",('${wfid}',)).fetchone()
n=c.execute("select nodes from workflow_history where versionId=?",('${versao}',)).fetchone()
print((ev[0] if ev else '-')+'|'+(ev[1] if ev else '-')+'|'+('sim' if n and 'build: ${build}' in n[0] else 'nao'))`;
const out = execFileSync('ssh', ['-i', KEY, '-o', 'BatchMode=yes', 'root@2.25.243.113', 'python3 -'], { input: py }).toString().trim();
const [evento, vEv, temBuild] = out.split('|');
if (evento !== 'activated' || vEv !== versao || temBuild !== 'sim') {
  console.error(`histórico/banco não confere: último evento=${evento} versão=${vEv} (esperada ${versao}) build ${build} na versão ativa=${temBuild}`); process.exit(7);
}
console.log(`publish pela API ✔ — ${wfid} ativo na versão ${versao} (build ${build}); histórico: activated`);
