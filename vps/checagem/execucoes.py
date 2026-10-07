#!/usr/bin/env python3
# Somente leitura: resume execuções do n8n (SQLite aberto em mode=ro) para as checagens do Robson.
# Imprime só nomes de nós, nº de itens, erros e campos numéricos/booleanos escolhidos — nunca dados de lead.
# Uso na VPS: python3 execucoes.py --workflow prspAgenteProsp1 --desde "2026-10-09 12:00:00" [--id 501]
import argparse, json, sqlite3, re

DB = 'file:/var/lib/docker/volumes/novax-vps-n8n_n8n_data/_data/database.sqlite?mode=ro'
# Campos seguros (contagens/flags) por nó; o resto da saída dos nós não é impresso.
CAMPOS = {
    'Calcular limite do dia': ['semanaEnvio', 'limite', 'enviadosHoje', 'restante', 'lote', 'modoTeste'],
    'Status envios (dia)': ['total_hoje', 'total_hoje_teste', 'followup_hoje', 'respostas_hoje', 'total_todos_hoje'],
    'Checar limite (lead)': ['cabe', 'enviados', 'limite'],
    'Resultado verificação (código)': ['safe', 'incompleto', 'disjuntor', 'falhasSeguidas'],
    'Resumo captação': ['leads_novos', 'sem_site_encontrados'],
    'Contexto da resposta': ['acao'],
    'Decidir próxima ação': ['acao'],
    'Montar proposta de horários': ['calendario_falhou', 'calendarioOk'],
    'Saída (C)': ['acao_v1'],
}
CONTAR = {'Resumo captação': ['excluidos_lista_manual', 'erros_places']}  # listas: só o tamanho


def flatted(texto):
    arr = json.loads(texto)
    cache = {}
    def get(i):
        v = arr[i]
        if isinstance(v, str):
            return v
        if i in cache:
            return cache[i]
        if isinstance(v, list):
            out = []; cache[i] = out; out.extend(conv(x) for x in v); return out
        if isinstance(v, dict):
            out = {}; cache[i] = out
            for k, x in v.items(): out[k] = conv(x)
            return out
        return v
    def conv(x):
        return get(int(x)) if isinstance(x, str) and x.isdigit() else x
    return get(0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--workflow', required=True)
    ap.add_argument('--desde', default='1970-01-01')
    ap.add_argument('--id', type=int)
    a = ap.parse_args()
    c = sqlite3.connect(DB, uri=True)
    q = ('select e.id, e.mode, e.status, e.startedAt, e.stoppedAt, e.workflowVersionId, d.data from execution_entity e '
         'left join execution_data d on d.executionId = e.id where e.workflowId = ? and e.startedAt >= ?')
    args = [a.workflow, a.desde]
    if a.id:
        q += ' and e.id = ?'; args.append(a.id)
    for eid, mode, status, ini, fim, ver, data in c.execute(q + ' order by e.id', args):
        print(f'#{eid} {mode} {status} {ini} → {fim} versão {ver}')
        if not data:
            print('   (sem dados de execução)'); continue
        run = (flatted(data).get('resultData') or {}).get('runData') or {}
        for no, runs in run.items():
            itens = sum(len(((r.get('data') or {}).get('main') or [[]])[0] or []) for r in runs)
            erro = next((r['error'].get('message', '')[:120] for r in runs if r.get('error')), '')
            print(f'   {no}: {len(runs)} run(s), {itens} item(ns)' + (f' ERRO: {erro}' if erro else ''))
            if no in CAMPOS or no in CONTAR:
                for r in runs[-3:]:
                    for it in (((r.get('data') or {}).get('main') or [[]])[0] or [])[:3]:
                        j = it.get('json') or {}
                        sel = {k: j.get(k) for k in CAMPOS.get(no, []) if k in j}
                        sel.update({k + '_qtd': len(j.get(k) or []) for k in CONTAR.get(no, [])})
                        if sel: print(f'      {json.dumps(sel, ensure_ascii=False)}')
        # build embutido nos Code nodes da versão executada
        h = c.execute('select nodes from workflow_history where versionId = ?', (ver,)).fetchone()
        if h: print('   build:', sorted(set(re.findall(r'build: ([0-9a-f]{12})', h[0]))))


main()
