// Passo 6 (entrada): só interessa e-mail que responde a uma thread iniciada pelo agente.
const m = $input.first().json;
const refs = Array.isArray(m.references) ? m.references : String(m.references || '').split(/\s+/);
const ids = [...new Set([m.inReplyTo, ...refs].map((s) => String(s || '').trim()).filter((s) => /^<.+@.+>$/.test(s)))];
const from = String(m.from?.value?.[0]?.address || '').toLowerCase();

// Remove o trecho citado ("Em ... escreveu:", "On ... wrote:", linhas com ">").
let texto = String(m.text || '').replace(/\r/g, '');
const corte = texto.search(/\n[^\n]*\n?[^\n]*(escreveu|wrote):\s*\n/i);
if (corte > 0) texto = texto.slice(0, corte);
texto = texto.split('\n').filter((l) => !l.trim().startsWith('>')).join('\n').trim().slice(0, 4000);

const ignorar = !ids.length || !from || from === CONFIG.remetente.email.toLowerCase();
// 23/11: aviso de não entrega (DSN) casa pelo References como se fosse resposta; marcamos para o ramo de bounce.
// Usa o texto bruto (o DSN não tem trecho citado, mas o corte de "wrote:" não pode esconder o código 5.x.x).
const bounce = ehBounce({ from, assunto: m.subject, texto: String(m.text || '') });
return [{ json: { ignorar, ids, from, texto, message_id: m.messageId || null, assunto: m.subject || '',
                  bounce, bounce_dados: bounce ? dadosBounce(m.text) : null,
                  in_reply_to: m.inReplyTo || null, references_raw: refs.filter(Boolean).join(' ') || null,
                  recebido_em: m.date ? new Date(m.date).toISOString() : agoraISO() } }];
