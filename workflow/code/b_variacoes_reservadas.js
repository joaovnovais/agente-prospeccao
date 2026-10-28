// Orçamento reservado (1 crédito, migration 007): devolve a variação da vez do lead atual para a Verifalia consultar.
// 28/10: uma por vez (ver b_variacoes.js); o estado vem do static data desta execução.
const st = $getWorkflowStaticData('global').variacoes;
if (!st || st.exec !== String($execution.id) || st.idx >= st.lista.length) throw new Error('estado das variações ausente ou esgotado');
return [{ json: { email: st.lista[st.idx], idx: st.idx, total: st.lista.length } }];
