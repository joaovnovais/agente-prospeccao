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

// Envios reais do dia que contam no limite do ramp-up (linha de prospeccao_status_envio). Desde a migration 005
// a view tem total_todos_hoje (todos os tipos: frio, follow-up e respostas); antes dela, só o frio (total_hoje).
const enviadosReaisHoje = (s) => Number((s || {}).total_todos_hoje ?? (s || {}).total_hoje ?? 0) || 0;

// Ajustes de revisão (1-2): nada de elogio/qualificação sem base nos dados, nada de promessa genérica.
const FRASES_PROIBIDAS = [
  [/[óo]tim[oa]s?\b/i, 'elogio "ótimo"'], [/excelen/i, 'elogio "excelente"'], [/incr[ií]vel/i, 'elogio "incrível"'],
  [/maravilh/i, 'elogio "maravilhoso"'], [/renomad/i, 'elogio "renomado"'], [/refer[êe]ncia/i, 'elogio "referência"'],
  [/conceituad/i, 'elogio "conceituado"'], [/reconhecid/i, 'elogio "reconhecido"'], [/tradicional/i, 'elogio "tradicional"'],
  [/de qualidade/i, 'elogio "de qualidade"'], [/(boas|muitas|diversas|v[áa]rias) avalia/i, 'qualificação vaga das avaliações (use o número)'],
  [/equipe extra/i, 'promessa "sem equipe extra"'], [/resultados reais/i, 'promessa "resultados reais"'], [/focad[oa] em resultado/i, 'promessa "focado em resultados"'],
  [/credibilidade/i, 'promessa vaga "credibilidade"'], [/garant/i, 'promessa "garantia"'], [/(dobrar|triplicar|multiplicar)/i, 'promessa de multiplicar resultados'],
  [/aumentar (as |suas |seu |o )?(vendas|faturamento|lucro)/i, 'promessa de aumento de vendas'],
  // 06/10: "boa avaliação" (singular) passava; a única afirmação permitida sobre avaliação é nota e quantidade.
  [/\bboas?\s+(avalia|nota|reputa)/i, 'elogio "boa avaliação"'], [/\bbem\s+avaliad/i, 'elogio "bem avaliada"'],
  [/\breputa[çc][ãa]o/i, 'qualificação "reputação"'], [/\b(nota\s+alta|alta\s+nota|altamente\s+avaliad)/i, 'qualificação "nota alta"'],
];
// 06/10: assunto não pode dizer/sugerir que a empresa já tem site ("… ganha site profissional" saiu em produção).
const ASSUNTO_SITE_EXISTE_RE = /(ganh(a|ou|e)|lan[çc](a|ou)|estreia|inaugura)\s+(o\s+|um\s+|seu\s+|novo\s+)*site|\bnovo\s+site\b|\bsite\s+(pronto|novo|no\s+ar|lan[çc]ado|j[áa]\s+est[áa])|(?<!n[ãa]o\s)(?<!sem\s)\b(tem|possui|j[áa]\s+tem)\s+(um\s+)?site\b/i;
// Sempre 1 casa decimal ("5,0"), coerente com a regra do prompt — antes a entrada dizia "5" e a IA escrevia "nota de 4".
const fmtNota = (r) => Number(r).toFixed(1).replace('.', ',');

// Todo número de nota/avaliações citado precisa bater com o Google Maps.
// Ampliado na auditoria (7/37 palavras comuns eram pegas; "Gostariamos" e "vincado" saíram em produção).
const SEM_ACENTO_RE = /\b(nao|voce|voces|servicos?|horarios?|reuni[ao]o|reunioes|avaliac(ao|oes)|informac(ao|oes)|clinicas?|esteticas?|pratica|diagnostico|gostariamos|tambem|atencao|soluc(ao|oes)|comunicacao|presenca|negocios?|otim[oa]s?|proxim[oa]s?|estao|sera|possivel|disponivel|facil|automatic[oa]s?|juridic[oa]s?|escritorio|previdenciari[oa]|familia|ja|ate|vincad[oa])\b/i;
function checarFatos(texto, lead) {
  const erros = [];
  // O nome pode estar cadastrado sem acento no Google (e a IA pode reescrevê-lo em outra caixa): removido sem diferenciar maiúsculas.
  const semNome = lead.nome ? texto.replace(new RegExp(String(lead.nome).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ') : texto;
  if (SEM_ACENTO_RE.test(semNome)) erros.push('texto sem acentuação (ex.: "' + semNome.match(SEM_ACENTO_RE)[0] + '")');
  for (const [re, nome] of FRASES_PROIBIDAS) if (re.test(texto)) erros.push('contém ' + nome);
  const t = texto.replace(/(\d)\.(\d)/g, '$1,$2');
  const notas = [...t.matchAll(/(\d(?:,\d)?)\s*estrelas|nota\s*(?:de\s*)?(\d(?:,\d)?)|(\d,\d)/gi)].map((m) => m[1] || m[2] || m[3]);
  for (const n of notas) if (lead.rating == null || Number(n.replace(',', '.')) !== Number(lead.rating)) erros.push(`nota "${n}" não bate com o Google (${lead.rating ?? 'sem nota'})`);
  for (const m of t.matchAll(/nota\s*(?:de\s*)?(\d)(?!\d|,\d)/gi)) erros.push(`nota "${m[1]}" sem casa decimal (use "${fmtNota(lead.rating ?? m[1])}")`);
  for (const m of t.matchAll(/(\d+)\s*avalia/gi)) if (Number(m[1]) !== Number(lead.total_avaliacoes)) erros.push(`"${m[1]} avaliações" não bate com o Google (${lead.total_avaliacoes ?? 0})`);
  // 06/10: com poucas avaliações, citar nota/quantidade enfraquece a abordagem ("nota 5,0 com 4 avaliações").
  const minAv = CONFIG.minAvaliacoesParaCitarNota || 0;
  if (lead.total_avaliacoes != null && Number(lead.total_avaliacoes) < minAv && (notas.length || /\d+\s*avalia/i.test(t) || /\bestrelas\b/i.test(t))) {
    erros.push(`cita nota/avaliações com só ${lead.total_avaliacoes} avaliações (mínimo ${minAv})`);
  }
  erros.push(...checarRamo(semNome, lead));
  return erros;
}

// Robson 2.0: o texto só pode atribuir um ramo à empresa se o nome ou o tipo no Google Maps sustentar esse ramo
// (ex.: chamar de "odontológica" uma clínica cujo tipo é "Spa"). Leads antigos, sem tipo do Google, usam o nicho da busca.
const RAMOS = [
  ['odontologia', /\b(odontolog\w*|dentist\w*|dental|dentari\w*|odonto)\b/, /odont|dent/],
  ['estética', /\b(estetic\w*|harmoniza\w*)\b/, /estetic|beauty|harmoniz|spa|skin|laser|depila/],
  ['advocacia', /\b(advocacia|advogad\w*|juridic\w*)\b/, /advoc|advog|juridic|law|direito/],
  ['veterinária', /\bveterinari\w*/, /veterin|\bvet\b|pet|animal/],
  ['mecânica', /\b(oficina mecanica|mecanica automotiva|auto center)\b/, /mecanic|oficina|auto|car repair|repair/],
  ['contabilidade', /\b(contab\w*|contador\w*)\b/, /contab|contador|accounting/],
  ['imobiliária', /\bimobiliari\w*/, /imobil|imoveis|real estate/],
  ['fisioterapia', /\bfisioterap\w*/, /fisio|physiotherap/],
  ['ótica', /\boticas?\b/, /otica|oculos|optic/],
  ['autoescola', /\bauto ?escola\w*/, /auto ?escola|driving/],
];
function checarRamo(texto, lead) {
  const temTipo = !!(lead.tipo_google || (lead.tipos_google || []).length);
  const evid = norm([lead.nome, lead.tipo_google, ...(lead.tipos_google || []), temTipo ? '' : String(lead.nicho || '').replace(/_/g, ' ')].join(' '));
  const t = norm(texto);
  return RAMOS.filter(([, re, ev]) => re.test(t) && !ev.test(evid)).map(([nome]) => `atribui ramo "${nome}" sem base no nome nem no tipo do Google`);
}

// Exclusões de clientes guardadas só como hash (o repositório é público): FNV-1a 64 bits em JS puro (BigInt, sem crypto)
// sobre o texto normalizado. Equivale ao "contém a frase" antigo: o nome vira o conjunto de hashes de todas as janelas
// contíguas de 1..exclusoesJanelaMax tokens, e cada frase da regra precisa estar nesse conjunto.
const fnv64 = (s) => {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) { h ^= BigInt(s.charCodeAt(i)); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return h.toString(16).padStart(16, '0');
};
const janelasHash = (texto, max) => {
  const t = norm(texto).split(' ').filter(Boolean);
  const out = new Set();
  for (let i = 0; i < t.length; i++) for (let k = 1; k <= max && i + k <= t.length; k++) out.add(fnv64(t.slice(i, i + k).join(' ')));
  return out;
};

// Palavras genéricas de ramo: sozinhas não identificam a empresa (clinica@gmail.com é de outra pessoa).
const GENERICAS = new Set(['clinica', 'clinicas', 'estetica', 'esteticas', 'odontologia', 'odontologica', 'odontologicas', 'odonto',
  'dentista', 'dentaria', 'consultorio', 'instituto', 'centro', 'espaco', 'studio', 'estudio', 'loja', 'lojas', 'advocacia',
  'advogados', 'advogado', 'escritorio', 'associados', 'avancada', 'integrada', 'especializada', 'saude', 'beauty', 'clinic',
  'imagem', 'facial', 'corporal', 'implantes', 'sorriso', 'ltda', 'eireli',
  // auditoria 2026-10-05: vocabulário jurídico e de serviços (semana de advocacia)
  'advogada', 'advogadas', 'consultoria', 'juridica', 'juridico', 'assessoria', 'direito', 'sociedade', 'individual', 'criminal',
  'criminalista', 'especialista', 'especializado', 'previdenciario', 'previdenciaria', 'familia', 'trabalhista', 'civil', 'tributario',
  'empresarial', 'regiao', 'matriz', 'filial', 'unidade', 'contato',
  // Robson 2.0 (todo segmento): termos de ramo do catálogo e de razão social também não identificam a empresa.
  'oficina', 'mecanica', 'mecanico', 'auto', 'autos', 'center', 'car', 'motos', 'pet', 'shop', 'petshop', 'veterinaria', 'veterinario',
  'vet', 'salao', 'barbearia', 'barber', 'cabeleireiro', 'cabeleireira', 'beleza', 'academia', 'fitness', 'pilates', 'crossfit',
  'contabilidade', 'contabil', 'contador', 'contadora', 'imobiliaria', 'imoveis', 'corretor', 'corretora', 'autoescola', 'escola',
  'idiomas', 'ingles', 'english', 'material', 'materiais', 'construcao', 'vidracaria', 'vidros', 'vidro', 'marmoraria', 'marmores',
  'granitos', 'serralheria', 'serralheiro', 'fisioterapia', 'fisio', 'reabilitacao', 'otica', 'oculos', 'assistencia', 'tecnica',
  'celular', 'celulares', 'cell', 'eletronicos', 'buffet', 'festas', 'eventos', 'dedetizadora', 'dedetizacao', 'pragas', 'grafica',
  'impressao', 'roupas', 'moda', 'cosmeticos', 'boutique', 'store', 'comercio', 'servicos', 'industria', 'distribuidora', 'grupo',
  'empresa', 'filhos', 'epp']);
// A cidade do lead não identifica a empresa (em "<Marca> Odonto <Cidade>" só a marca é distintiva).
const palavrasDistintivas = (nome, cidade = '') => {
  const daCidade = new Set(norm(cidade).split(' '));
  return norm(nome).split(' ')
    .filter((w) => w.length >= 3 && !GENERICAS.has(w) && !daCidade.has(w) && !['de', 'da', 'do', 'das', 'dos', 'dra', 'dr', 'the'].includes(w));
};
// Candidato só vale se o usuário do e-mail contém palavras distintivas do nome: 2 delas quando o nome tem 2+
// (auditoria 05/10: um endereço só com o primeiro nome de uma pessoa passava com 1 palavra).
// Homônimo (06/10): em provedor gratuito, um endereço apoiado numa ÚNICA palavra que é sobrenome comum
// ("<sobrenome>advocacia@…") pode ser de qualquer xará no país — o Reacher só prova que a caixa existe, não de quem é.
const PROVEDOR_GRATUITO = /@(gmail|googlemail|hotmail|outlook|live|msn|yahoo|bol|uol|terra|ig|icloud)\./;
const SOBRENOMES_COMUNS = new Set((CONFIG.sobrenomesComuns || []).map((s) => norm(s)));
const emailIdentificaEmpresa = (email, nome, cidade = '') => {
  const u = email.split('@')[0].replace(/[^a-z0-9]/g, '');
  const ds = palavrasDistintivas(nome, cidade);
  const achadas = ds.filter((w) => u.includes(w));
  if (!ds.length || achadas.length < Math.min(2, ds.length)) return false;
  if (PROVEDOR_GRATUITO.test(email) && achadas.length === 1 && SOBRENOMES_COMUNS.has(achadas[0])) return false;
  return true;
};

// Advocacia: só escritórios (decisão do João, 05/10/2026). Pessoa física (autônomo) e entidade de classe/órgão não são capturados.
// Ordem: entidade → marcador de banca (escritório) → pessoa física com alta confiança → ambíguo (mantido, conservador).
const ENTIDADE_RE = /\b(ordem dos advogados|oab|conselho|defensoria|procuradoria|forum|tribunal|cartorio|sindicato|subsecao)\b/;
const BANCA_RE = /\b(advocacia|advogados|associados|sociedade|escritorio|juridic[ao]s?|law|partners)\b/;
function classificarAdvocacia(nome) {
  const n = norm(nome);
  if (ENTIDADE_RE.test(n)) return 'entidade';
  if (BANCA_RE.test(n) || nome.includes('&')) return 'escritorio';
  if (/^(dr|dra|adv)\b/.test(n) || /\b(advogad[oa]|criminalista)\b/.test(n)) return 'pessoa_fisica';
  const palavras = n.split(' ').filter(Boolean);
  // Só 2–3 prenomes/sobrenomes soltos (critério do João); 4+ palavras sem marcador ficam como ambíguo (mantidos).
  if (palavras.length >= 2 && palavras.length <= 3 && palavras.every((w) => /^[a-z]+$/.test(w))) return 'pessoa_fisica';
  return 'ambiguo';
}

// Robson 2.0 — filtros de perfil para todos os nichos (advocacia mantém a regra própria acima).
// Fora do perfil: pessoa física/autônomo, entidade de classe, órgão público e instituição religiosa.
const RELIGIOSA_RE = /\b(igreja|paroquia|capela|templo|ministerio|assembleia de deus|congregacao|comunidade evangelica|centro espirita|terreiro|diocese|mosteiro|convento|santuario)\b/;
const ORGAO_RE = /\b(prefeitura|secretaria|municipal|estadual|federal|governo|camara de vereadores|camara municipal|detran|ubs|posto de saude|policia|bombeiros|tribunal|forum|defensoria|procuradoria|cartorio|senai|sesi|senac|sesc|sebrae)\b/;
const ENTIDADE_GERAL_RE = /\b(ordem dos|oab|conselho|sindicato|federacao|confederacao|associacao)\b/;
const TIPOS_RELIGIOSA = ['church', 'place_of_worship', 'mosque', 'synagogue', 'hindu_temple'];
const TIPOS_ORGAO = ['local_government_office', 'city_hall', 'courthouse', 'police', 'fire_station', 'embassy', 'post_office'];
const NICHOS_SAUDE = new Set(['odontologia_estetica', 'estetica_harmonizacao', 'fisioterapia', 'pet_veterinaria']);
function classificarPerfil(nome, tipos = [], nicho = '') {
  const n = norm(nome);
  const ts = (tipos || []).map(String);
  if (RELIGIOSA_RE.test(n) || ts.some((t) => TIPOS_RELIGIOSA.includes(t))) return 'religiosa';
  if (ORGAO_RE.test(n) || ts.some((t) => TIPOS_ORGAO.includes(t))) return 'orgao_publico';
  if (nicho === 'advocacia') {
    const a = classificarAdvocacia(nome);
    return a === 'escritorio' || a === 'ambiguo' ? 'ok' : a;
  }
  if (ENTIDADE_GERAL_RE.test(n)) return 'entidade';
  const palavras = n.split(' ').filter(Boolean);
  const temMarca = palavras.some((w) => GENERICAS.has(w));
  if (/\b(autonom[oa]|mei|personal trainer)\b/.test(n)) return 'pessoa_fisica';
  // Saúde: consultório com o nome do profissional ("Dra. <Nome>") é o próprio negócio-alvo (já houve envio real assim).
  if (NICHOS_SAUDE.has(nicho)) return 'ok';
  if (!temMarca && /^(dr|dra|prof|profa)\b/.test(n)) return 'pessoa_fisica';
  // 2–3 palavras soltas, sem termo de ramo, com sobrenome comum depois da 1ª ("Carlos Silva"); "Bella Moda" fica.
  if (!temMarca && palavras.length >= 2 && palavras.length <= 3 && palavras.every((w) => /^[a-z]+$/.test(w))
      && palavras.slice(1).some((w) => SOBRENOMES_COMUNS.has(w))) return 'pessoa_fisica';
  return 'ok';
}

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
