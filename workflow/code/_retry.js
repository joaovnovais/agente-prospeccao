// Retry com feedback: devolve ao modelo a resposta rejeitada + o motivo e pede só o JSON.
const j = $input.first().json;
const messages = [...j.messages];
if (j.raw) messages.push({ role: 'assistant', content: String(j.raw).slice(0, 1500) });
messages.push({ role: 'user', content:
  `Sua resposta anterior foi rejeitada pelo validador: ${j.erro}. ` +
  'Responda novamente APENAS com o objeto JSON no formato exigido, começando com "{" e terminando com "}", sem nenhum texto fora dele.' });
return [{ json: { ...j, tentativa: j.tentativa + 1, messages, raw: undefined, erro: undefined, ok: undefined } }];
