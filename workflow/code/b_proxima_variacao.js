// 28/10: a variação da vez não confirmou e ainda há outra na lista → avança e volta para reservar 1 crédito.
const st = $getWorkflowStaticData('global').variacoes;
if (!st || st.exec !== String($execution.id)) throw new Error('estado das variações ausente');
st.idx += 1;
return [{ json: { proxima: st.lista[st.idx] ? st.idx : null } }];
