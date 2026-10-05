// ---- biblioteca compartilhada (injetada pelo build.mjs em todo Code node) ----

const norm = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

// Frases típicas de recusa/desvio de modelos instrucionais (pt/en).
const RECUSA_RE = /(n[aã]o posso (ajudar|atender|criar|gerar|fazer)|como (um|uma) (modelo|ia|assistente)|modelo de linguagem|sinto muito, mas|i can(no|')t (help|assist|do)|i('| a)m sorry|as an ai|i('| a)m unable|against (my|the) (guidelines|policy))/i;

// Saída de IA → {ok, erro, tipo_falha, obj}. Salvaguardas 1 e 2 do projeto:
// só aceita JSON puro (cercas ``` são toleradas); texto antes do "{" é tratado como desvio.
function parseRespostaIA(resp) {
  if (!resp || resp.error || !resp.choices) {
    const msg = resp?.error?.message || resp?.error || 'sem choices na resposta';
    return { ok: false, tipo_falha: 'api', erro: 'erro da API: ' + String(typeof msg === 'string' ? msg : JSON.stringify(msg)).slice(0, 300), raw: '' };
  }
  let raw = resp.choices?.[0]?.message?.content ?? '';
  if (typeof raw !== 'string') raw = JSON.stringify(raw);
  const p = parseTextoIA(raw);
  // Resposta cortada pelo limite de tokens nunca é aceita, mesmo que pareça JSON.
  if (resp.choices?.[0]?.finish_reason === 'length') {
    return { ok: false, tipo_falha: 'formato', erro: 'resposta truncada no limite de tokens' + (p.ok ? '' : ' — ' + p.erro), raw };
  }
  return p;
}

function parseTextoIA(raw) {
  const t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (!t) return { ok: false, tipo_falha: 'formato', erro: 'resposta vazia', raw };
  if (!t.startsWith('{')) {
    const recusa = RECUSA_RE.test(t.slice(0, 600));
    return { ok: false, tipo_falha: recusa ? 'recusa' : 'formato',
             erro: recusa ? 'modelo recusou/desviou (texto de recusa em vez de JSON)' : 'resposta não é JSON (texto explicativo antes/no lugar do objeto)', raw };
  }
  try {
    return { ok: true, obj: JSON.parse(t), raw };
  } catch (e) {
    return { ok: false, tipo_falha: 'formato', erro: 'JSON malformado: ' + e.message, raw };
  }
}

const RESPOSTA_MALFORMADA_TESTE =
  'Claro! Aqui está uma sugestão de e-mail para essa empresa:\n\nOlá, tudo bem? Vi que vocês ainda não têm site...\n\n(Espero que ajude!)';

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const linkificar = (html) => {
  let out = html;
  // Mais longo primeiro, para "instagram.com/novax.ia.br" não ser quebrado pelo link de "novax.ia.br".
  const links = Object.entries(CONFIG.remetente.links || {}).sort((a, b) => b[0].length - a[0].length);
  const marcas = [];
  for (const [txt, url] of links) {
    const re = new RegExp('(?<![\\w@./])' + txt.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?![\\w@])', 'g');
    out = out.replace(re, () => { marcas.push(`<a href="${url}">${txt}</a>`); return `\u0000${marcas.length - 1}\u0000`; });
  }
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => marcas[Number(i)]);
};
const textoParaHtml = (t) => '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">'
  + linkificar(escHtml(t)).split('\n').join('<br>') + '</div>';

const assuntoResposta = (a) => 'Re: ' + String(a || '').replace(/^\s*(\[TESTE[^\]]*\]\s*)?((re|res|fw|enc):\s*)*/i, '');

const rodapeLGPD = (lead) =>
  `\n\n${CONFIG.remetente.assinatura}\n\n—\nVocê recebeu esta mensagem porque ${lead.nome} aparece como empresa no Google Maps em ${lead.cidade}/${lead.estado}. ` +
  'Se não quiser receber novos contatos da Novax, responda com a palavra SAIR e removemos seu e-mail imediatamente.';

const agoraISO = () => new Date().toISOString();

// Ajustes de revisão (1-2): nada de elogio/qualificação sem base nos dados, nada de promessa genérica.
const FRASES_PROIBIDAS = [
  [/[óo]tim[oa]s?\b/i, 'elogio "ótimo"'], [/excelen/i, 'elogio "excelente"'], [/incr[ií]vel/i, 'elogio "incrível"'],
  [/maravilh/i, 'elogio "maravilhoso"'], [/renomad/i, 'elogio "renomado"'], [/refer[êe]ncia/i, 'elogio "referência"'],
  [/conceituad/i, 'elogio "conceituado"'], [/reconhecid/i, 'elogio "reconhecido"'], [/tradicional/i, 'elogio "tradicional"'],
  [/de qualidade/i, 'elogio "de qualidade"'], [/(boas|muitas|diversas|v[áa]rias) avalia/i, 'qualificação vaga das avaliações (use o número)'],
  [/equipe extra/i, 'promessa "sem equipe extra"'], [/resultados reais/i, 'promessa "resultados reais"'], [/focad[oa] em resultado/i, 'promessa "focado em resultados"'],
  [/credibilidade/i, 'promessa vaga "credibilidade"'], [/garant/i, 'promessa "garantia"'], [/(dobrar|triplicar|multiplicar)/i, 'promessa de multiplicar resultados'],
  [/aumentar (as |suas |seu |o )?(vendas|faturamento|lucro)/i, 'promessa de aumento de vendas'],
];
// Sempre 1 casa decimal ("5,0"), coerente com a regra do prompt — antes a entrada dizia "5" e a IA escrevia "nota de 4".
const fmtNota = (r) => Number(r).toFixed(1).replace('.', ',');

// Todo número de nota/avaliações citado precisa bater com o Google Maps.
// Ampliado na auditoria (7/37 palavras comuns eram pegas; "Gostariamos" e "vincado" saíram em produção).
const SEM_ACENTO_RE = /\b(nao|voce|voces|servicos?|horarios?|reuni[ao]o|reunioes|avaliac(ao|oes)|informac(ao|oes)|clinicas?|esteticas?|pratica|diagnostico|gostariamos|tambem|atencao|soluc(ao|oes)|comunicacao|presenca|negocios?|otim[oa]s?|proxim[oa]s?|estao|sera|possivel|disponivel|facil|automatic[oa]s?|juridic[oa]s?|escritorio|previdenciari[oa]|familia|ja|ate|vincad[oa])\b/i;
function checarFatos(texto, lead) {
  const erros = [];
  const semNome = texto.split(lead.nome || '0000').join(' '); // o nome pode estar cadastrado sem acento no Google
  if (SEM_ACENTO_RE.test(semNome)) erros.push('texto sem acentuação (ex.: "' + semNome.match(SEM_ACENTO_RE)[0] + '")');
  for (const [re, nome] of FRASES_PROIBIDAS) if (re.test(texto)) erros.push('contém ' + nome);
  const t = texto.replace(/(\d)\.(\d)/g, '$1,$2');
  const notas = [...t.matchAll(/(\d(?:,\d)?)\s*estrelas|nota\s*(?:de\s*)?(\d(?:,\d)?)|(\d,\d)/gi)].map((m) => m[1] || m[2] || m[3]);
  for (const n of notas) if (lead.rating == null || Number(n.replace(',', '.')) !== Number(lead.rating)) erros.push(`nota "${n}" não bate com o Google (${lead.rating ?? 'sem nota'})`);
  for (const m of t.matchAll(/nota\s*(?:de\s*)?(\d)(?![,\d])/gi)) erros.push(`nota "${m[1]}" sem casa decimal (use "${fmtNota(lead.rating ?? m[1])}")`);
  for (const m of t.matchAll(/(\d+)\s*avalia/gi)) if (Number(m[1]) !== Number(lead.total_avaliacoes)) erros.push(`"${m[1]} avaliações" não bate com o Google (${lead.total_avaliacoes ?? 0})`);
  return erros;
}

// Palavras genéricas de ramo: sozinhas não identificam a empresa (clinica@gmail.com é de outra pessoa).
const GENERICAS = new Set(['clinica', 'clinicas', 'estetica', 'esteticas', 'odontologia', 'odontologica', 'odontologicas', 'odonto',
  'dentista', 'dentaria', 'consultorio', 'instituto', 'centro', 'espaco', 'studio', 'estudio', 'loja', 'lojas', 'advocacia',
  'advogados', 'advogado', 'escritorio', 'associados', 'avancada', 'integrada', 'especializada', 'saude', 'beauty', 'clinic',
  'imagem', 'facial', 'corporal', 'implantes', 'sorriso', 'ltda', 'eireli',
  // auditoria 2026-10-05: vocabulário jurídico e de serviços (semana de advocacia)
  'advogada', 'advogadas', 'consultoria', 'juridica', 'juridico', 'assessoria', 'direito', 'sociedade', 'individual', 'criminal',
  'criminalista', 'especialista', 'especializado', 'previdenciario', 'previdenciaria', 'familia', 'trabalhista', 'civil', 'tributario',
  'empresarial', 'regiao', 'matriz', 'filial', 'unidade', 'contato']);
// A cidade do lead não identifica a empresa ("Gou Odonto Rio Verde" → só "gou" é distintivo).
const palavrasDistintivas = (nome, cidade = '') => {
  const daCidade = new Set(norm(cidade).split(' '));
  return norm(nome).split(' ')
    .filter((w) => w.length >= 3 && !GENERICAS.has(w) && !daCidade.has(w) && !['de', 'da', 'do', 'das', 'dos', 'dra', 'dr', 'the'].includes(w));
};
// Candidato só vale se o usuário do e-mail contém palavras distintivas do nome: 2 delas quando o nome tem 2+
// (auditoria: "kemile@gmail.com" p/ "Dra Kemile Teles" passava com 1 palavra = primeiro nome de qualquer pessoa).
const emailIdentificaEmpresa = (email, nome, cidade = '') => {
  const u = email.split('@')[0].replace(/[^a-z0-9]/g, '');
  const ds = palavrasDistintivas(nome, cidade);
  return ds.filter((w) => u.includes(w)).length >= Math.min(2, ds.length) && ds.length > 0;
};

// Ajuste 5: variações determinísticas a partir do nome EXATO (só Gmail: é o único provedor que o Reacher confirma).
function variantesEmail(nome, cidade = '') {
  const palavras = norm(nome).split(' ').filter(Boolean);
  const semConectivos = palavras.filter((w) => !['de', 'da', 'do', 'das', 'dos', 'e', 'dra', 'dr'].includes(w));
  const slugs = [...new Set([palavras.join(''), semConectivos.join('')])];
  const out = [];
  for (const s of slugs) out.push(`${s}@gmail.com`, `contato.${s}@gmail.com`);
  return out.filter((e) => emailIdentificaEmpresa(e, nome, cidade));
}
// Gmail só aceita usuário de 6 a 30 caracteres: descarta candidatos impossíveis antes do Reacher.
// Reacher nunca conclui Hotmail/Outlook/Yahoo (50/50 HeadlessError): consultar só gasta tempo e tarpit.
const PROVEDOR_SEM_VERIFICACAO = /@(hotmail|outlook|live|msn|yahoo)\./;
const emailPossivel = (e) => {
  if (PROVEDOR_SEM_VERIFICACAO.test(e)) return false;
  if (!e.endsWith('@gmail.com')) return true;
  const u = e.split('@')[0];
  return u.length >= 6 && u.length <= 30;
};
// ---- fim da biblioteca ----
