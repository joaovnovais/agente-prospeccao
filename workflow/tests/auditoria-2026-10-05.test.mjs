// Regressão dos patches da auditoria 2026-10-05 — offline (sem rede, IA ou banco). Uso: node workflow/tests/auditoria-2026-10-05.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const lib = new Function('CONFIG', LIB + '; return { variantesEmail, emailPossivel, emailIdentificaEmpresa, checarFatos, fmtNota, classificarAdvocacia };')(CONFIG);
const rodar = (f, input) => new Function('$input', '$', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/${f}`, 'utf8'))({ first: () => input[0], all: () => input }, () => ({ first: () => undefined }), CONFIG);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };
console.log('A4 trava de e-mail / provedores');
ok(!lib.emailIdentificaEmpresa('kemile@gmail.com', 'Dra Kemile Teles'), 'kemile@ recusado (só primeiro nome)');
ok(lib.emailIdentificaEmpresa('kemileteles@gmail.com', 'Dra Kemile Teles'), 'kemileteles@ aceito (2 palavras do nome)');
ok(!lib.emailIdentificaEmpresa('consultoriajuridica@gmail.com', 'Machado - Advocacia e consultoria jurídica'), 'consultoriajuridica@ recusado (termos genéricos)');
ok(!lib.emailIdentificaEmpresa('advogada.indaial@gmail.com', 'Laina Maiana Advogada'), 'advogada.indaial@ recusado');
ok(lib.emailIdentificaEmpresa('macohin@gmail.com', 'Macohin Advogados Associados'), 'nome de 1 palavra distintiva (macohin@) continua aceito');
ok(!lib.emailIdentificaEmpresa('clinica@gmail.com', 'Clínica'), 'clinica@ continua recusado');
ok(!lib.emailPossivel('clinicax@hotmail.com') && lib.emailPossivel('clinicax@gmail.com'), 'hotmail recusado, gmail aceito');
ok(lib.variantesEmail('Dermo Beauty Estética').includes('dermobeautyestetica@gmail.com'), 'variação que já gerou envio real continua sendo gerada');
console.log('A5 acentuação e nota');
const L = { nome: 'Gou Odonto', rating: 4.9, total_avaliacoes: 62 };
ok(lib.checarFatos('Gostariamos de agendar.', L).length > 0, '"Gostariamos" agora é rejeitado');
ok(lib.checarFatos('não há um site vincado ao perfil', L).length > 0, '"vincado" agora é rejeitado');
ok(lib.checarFatos('Gostaríamos de agendar. Não há site vinculado. A nota 4,9 com 62 avaliações.', L).length === 0, 'texto correto continua passando');
ok(lib.checarFatos('possui uma nota de 4 no Google', { nome: 'X', rating: 4, total_avaliacoes: 51 }).length > 0, '"nota de 4" rejeitado (pede 4,0)');
ok(lib.fmtNota(5) === '5,0' && lib.fmtNota(4.7) === '4,7', 'fmtNota sempre com 1 casa decimal');
ok(lib.checarFatos('A Clinica Plena Saúde Estética tem nota 5,0.', { nome: 'Clinica Plena Saúde Estética', rating: 5, total_avaliacoes: 10 }).length === 0, 'nome cadastrado sem acento não gera falso positivo');
console.log('A6 opt-out');
const re = eval(readFileSync(`${R}/code/c_contexto.js`, 'utf8').match(/const OPTOUT_RE = (\/.*\/[a-z]*);/)[1]);
for (const [t, e] of [['pode tirar meu email', 1], ['quero sair da lista', 1], ['SAIR', 1], ['Vou sair de férias, retorno dia 10', 0], ['Gostaria de remarcar', 0]]) ok(re.test(t) === !!e, `${e ? 'opt-out' : 'normal '}: "${t}"`);
console.log('A3 fallback inconclusivo');
const lead = { id: 'L', nome: 'X', tentativas_fallback: 0 };
const r1 = rodar('b_descarte.js', [{ json: { tem_email: false, lead, verificados: [{ email: 'a@gmail.com', status: 'unknown' }, { email: 'b@gmail.com', status: 'erro' }] } }])[0].json;
ok(r1.lead_patch.status === 'novo' && r1.lead_patch.tentativas_fallback === 1, 'todos unknown → volta p/ fila (tentativa 1)');
const r2 = rodar('b_descarte.js', [{ json: { tem_email: false, lead: { ...lead, tentativas_fallback: 1 }, verificados: [{ email: 'a@gmail.com', status: 'unknown' }] } }])[0].json;
ok(r2.lead_patch.status === 'sem_email', 'atingiu maxTentativasFallback (2) → sem_email');
const r3 = rodar('b_descarte.js', [{ json: { tem_email: false, lead, verificados: [{ email: 'a@gmail.com', status: 'unknown' }, { email: 'b@gmail.com', status: 'invalid' }] } }])[0].json;
ok(r3.lead_patch.status === 'sem_email', 'mistura com invalid continua sem_email (comportamento atual)');
const r4 = rodar('b_descarte.js', [{ json: { bloqueado: true, lead, motivo: 'bloqueado: x' } }])[0].json;
ok(r4.lead_patch.status === 'descartado', 'bloqueio LGPD inalterado');
console.log('Fase 2 advocacia só escritórios');
for (const [nome, esp] of [['Ordem dos Advogados do Brasil', 'entidade'], ['Dr. João Silva Advogado', 'pessoa_fisica'], ['Silva & Souza Advogados Associados', 'escritorio'],
  ['Escritório Pereira', 'escritorio'], ['Macohin Advogados Associados', 'escritorio'], ['Thiago Farias', 'pessoa_fisica'], ['Hellen Greffin Advogada', 'pessoa_fisica'],
  ['Dra. Larissa dos Passos Sipriano - Advogada especialista em família e sucessões.', 'pessoa_fisica'], ['Defensoria Pública de SC', 'entidade'], ['Baltazar Advocacia', 'escritorio']]) {
  ok(lib.classificarAdvocacia(nome) === esp, `"${nome}" → ${esp}`);
}
ok(lib.checarFatos('O Escritorio Advocacia Pereira Mafra não tem site.', { nome: 'ESCRITORIO ADVOCACIA PEREIRA MAFRA', rating: 5, total_avaliacoes: 2 }).length === 0, 'nome sem acento em outra caixa não gera falso positivo');
console.log('config'); ok(CONFIG.exclusoes.some((e) => (e.nome || []).includes('ordem dos advogados')), 'OAB na lista de exclusão');
console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
