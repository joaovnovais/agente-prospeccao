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
return [{ json: { ignorar, ids, from, texto, message_id: m.messageId || null, assunto: m.subject || '',
                  recebido_em: m.date ? new Date(m.date).toISOString() : agoraISO() } }];
