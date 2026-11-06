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
const NUM_EXTENSO = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };
const NUM_EXTENSO_RE = 'um|uma|dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez';
const numExtenso = (w) => String(NUM_EXTENSO[w.toLowerCase().replace('ê', 'e')]);
// 21/10: teto de gasto da IA no lugar da trava ":free". Pior caso do mês: todo dia no teto diário de chamadas
// (limiteDiarioOpenRouter, que soma envio e respostas), 23 dias, cada chamada com tokensEntradaMaxIA de entrada e
// maxTokensIA de saída, no modelo mais caro da lista. Modelo sem preço declarado em precosIA → recusado.
// O limite mensal da chave na OpenRouter (US$ 2, reset mensal) é a trava final; esta é a da configuração.
function gastoMaximoMensalIA(cfg) {
  const semPreco = (cfg.modelos || []).filter((m) => !Array.isArray((cfg.precosIA || {})[m]));
  if (!(cfg.modelos || []).length || semPreco.length) return { ok: false, motivo: `modelo sem preço declarado: ${semPreco.join(', ') || '(lista vazia)'}` };
  const porChamada = Math.max(...cfg.modelos.map((m) => (cfg.tokensEntradaMaxIA * cfg.precosIA[m][0] + cfg.maxTokensIA * cfg.precosIA[m][1]) / 1e6));
  const usd = porChamada * cfg.limiteDiarioOpenRouter * 23;
  return { ok: usd <= cfg.tetoGastoIAMensalUSD, usd: Math.round(usd * 100) / 100, teto: cfg.tetoGastoIAMensalUSD,
           motivo: usd <= cfg.tetoGastoIAMensalUSD ? null : `pior caso US$ ${usd.toFixed(2)}/mês > teto US$ ${cfg.tetoGastoIAMensalUSD}` };
}

// 13/10: assunto padrão quando a IA erra o assunto. Copy v2: é o formato sorteado do lead montado pelo código.
// 21/10: sempre existe — o nome curto agora é do código (nomeCurtoAssunto), não da IA (7 das 8 reprovações de 21/10 eram
// nomes com mais de 4 palavras, em que a IA inventava a forma curta e o código não tinha como corrigir).
const assuntoPadrao = (lead) => montarAssunto(formatoAssunto(lead), lead, nomeCurtoAssunto(lead));
function checarFatos(texto, lead) {
  const erros = [];
  // O nome pode estar cadastrado sem acento no Google (e a IA pode reescrevê-lo em outra caixa): removido sem diferenciar maiúsculas.
  const semNome = lead.nome ? texto.replace(new RegExp(String(lead.nome).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ') : texto;
  if (SEM_ACENTO_RE.test(semNome)) erros.push('texto sem acentuação (ex.: "' + semNome.match(SEM_ACENTO_RE)[0] + '")');
  for (const [re, nome] of FRASES_PROIBIDAS) if (re.test(texto)) erros.push('contém ' + nome);
  // 07/10: "tem uma avaliação no Google" passou (lead com 1 avaliação) porque só dígitos eram reconhecidos.
  // Número por extenso (um/uma…dez) antes de avaliação/estrela e depois de "nota" vira dígito antes das checagens.
  // Exceção: "uma avaliação de 4,9" / "uma avaliação no Google de 5,0" é artigo (= a nota), não quantidade (2 envios reais assim).
  const t = texto.replace(/(\d)\.(\d)/g, '$1,$2')
    .replace(new RegExp(`\\b(${NUM_EXTENSO_RE})(?:\\s+[uú]nicas?)?(?=\\s+(?:avalia|estrela))(?!\\s+avalia[çc][ãa]o[^.;!?]{0,40}?\\d,\\d)`, 'gi'), (_, w) => numExtenso(w))
    .replace(new RegExp(`\\b(nota\\s*(?:de\\s*)?)(${NUM_EXTENSO_RE})(?![\\wÀ-ÿ])`, 'gi'), (_, a, w) => a + numExtenso(w));
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
  const completo = palavras.join(''), semCon = semConectivos.join('');
  // 28/10: ordem pela taxa histórica de acerto (config.ordemVariacoes). Até 28/10, das 44 confirmações por variação:
  // completo 36, contato.completo 6, sem_conectivos 1, contato.sem_conectivos 0. A verificação para no 1º confirmado.
  const porPadrao = { completo: `${completo}@gmail.com`, 'contato.completo': `contato.${completo}@gmail.com` };
  if (semCon !== completo) Object.assign(porPadrao, { sem_conectivos: `${semCon}@gmail.com`, 'contato.sem_conectivos': `contato.${semCon}@gmail.com` });
  const ordem = CONFIG.ordemVariacoes || ['completo', 'contato.completo', 'sem_conectivos', 'contato.sem_conectivos'];
  const out = [...ordem, ...Object.keys(porPadrao).filter((k) => !ordem.includes(k))].map((k) => porPadrao[k]).filter(Boolean);
  return [...new Set(out)].filter((e) => emailIdentificaEmpresa(e, nome, cidade));
}
// Gmail só aceita usuário de 6 a 30 caracteres: descarta candidatos impossíveis antes do verificador.
// 26/10: Hotmail/Outlook/Yahoo reativados. O Reacher nunca os concluía (50/50 HeadlessError); a Verifalia resolveu 14 de 16.
const emailPossivel = (e) => {
  if (!e.endsWith('@gmail.com')) return true;
  const u = e.split('@')[0];
  return u.length >= 6 && u.length <= 30;
};
// ---- Copy v2 (12/10/2026): primeiro e-mail de uma pessoa para outra ----
// Formato do assunto sorteado pelo código, não pela IA: hash FNV do lead.id, misturado (fmix64 do MurmurHash3: o FNV
// sozinho deixa ids parecidos no mesmo formato), módulo o nº de formatos. Determinístico: a nova tentativa do mesmo lead
// recebe o mesmo formato.
const M64 = 0xffffffffffffffffn;
const fmix64 = (h) => {
  h ^= h >> 33n; h = (h * 0xff51afd7ed558ccdn) & M64;
  h ^= h >> 33n; h = (h * 0xc4ceb9fe1a85ec53n) & M64;
  return h ^ (h >> 33n);
};
const formatoAssunto = (lead) => {
  const fs = CONFIG.assuntoFormatos || [];
  return fs[Number(fmix64(BigInt('0x' + fnv64(String(lead.id ?? lead.nome ?? '')))) % BigInt(fs.length))];
};
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Nome em CAIXA ALTA no Google ("ADVOCACIA EXEMPLO") vira "Advocacia Exemplo" no texto; os demais ficam como estão.
const CONECTIVOS_NOME = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os']);
const nomeExibicao = (nome) => {
  const s = String(nome || '').trim();
  if (s !== s.toUpperCase() || !/\p{Lu}/u.test(s)) return s;
  return s.toLowerCase().split(/\s+/).map((w, i) => (i && CONECTIVOS_NOME.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
};
const nomeCabeNoAssunto = (lead) => norm(lead.nome).split(' ').filter(Boolean).length <= 4;
// 21/10: palavra inteira em maiúsculas com 4+ letras ("BEAUTY") → "Beauty". Siglas curtas ("MS", "3D") ficam.
const normalizarCaixa = (s) => String(s).replace(/\p{L}+/gu, (w) => (w.length >= 4 && w === w.toUpperCase() && w !== w.toLowerCase()
  ? w.charAt(0) + w.slice(1).toLowerCase() : w));
// 21/10: forma curta do nome feita pelo código (determinística): corta no 1º separador (" - ", "|", "/", "(", ","),
// fica com até 4 palavras sem terminar em conectivo ("de", "&"...) e normaliza a caixa. Só usa palavras do nome real.
const nomeCurtoAssunto = (lead) => {
  const base = nomeExibicao(lead.nome).split(/\s+[-–—|\/]\s+|\s*[|(]\s*|\s*,\s*/)[0].trim() || nomeExibicao(lead.nome);
  const ws = base.split(/\s+/).filter(Boolean).slice(0, 4);
  // não termina em conectivo, símbolo ou título de pessoa ("Escritório de Advocacia Dra." → "Escritório de Advocacia")
  while (ws.length > 1 && (CONECTIVOS_NOME.has(norm(ws[ws.length - 1])) || !norm(ws[ws.length - 1])
    || /^(dra?|sra?|prof|profa)$/.test(norm(ws[ws.length - 1])))) ws.pop();
  return normalizarCaixa(ws.join(' '));
};
const montarAssunto = (formato, lead, nome = nomeExibicao(lead.nome)) => formato.replace('{nome}', nome).replace('{cidade}', lead.cidade);
// Nome com marcador de mais de uma pessoa: aí "vocês" / "o escritório" é natural; nos demais, "você".
const nomeSugerePlural = (nome) => /&/.test(String(nome || ''))
  || /\b(advogad[oa]s|associad[oa]s|sociedade|socios|irmaos|filhos|parceiros|equipe|grupo)\b|\se\s/.test(' ' + norm(nome) + ' ');

// Assunto: formato sorteado (3 a 7 palavras, nome e cidade contam 1 cada), sem nota/avaliações nem os padrões antigos.
const ASSUNTO_PROIBIDO_V2 = /\b(pode aparecer|sem site|ganha|tem nota|presenca digital)\b/;
function checarAssuntoV2(assunto, lead) {
  const erros = [];
  const a = String(assunto || '').trim();
  const fmt = formatoAssunto(lead);
  const n = norm(a);
  const nFmt = norm(fmt.replace(/\{\w+\}/g, ' ')).split(' ').filter(Boolean).length + (fmt.match(/\{\w+\}/g) || []).length;
  if (nFmt < 3 || nFmt > 7) erros.push(`formato do config fora de 3-7 palavras ("${fmt}")`);
  if (/!/.test(a)) erros.push('com ponto de exclamação');
  if (/\p{Extended_Pictographic}/u.test(a)) erros.push('com emoji');
  if (!/^[\p{Lu}0-9]/u.test(a)) erros.push('não começa com letra maiúscula');
  // 21/10: tira do assunto o nome (inteiro, de exibição e a forma curta do código) antes de procurar CAIXA ALTA e dígitos:
  // "Clínica 3D Imagem Facial" não "cita nota" por ter um 3 no nome.
  let semNome = a;
  for (const nm of [lead.nome, nomeExibicao(lead.nome), nomeCurtoAssunto(lead)].filter(Boolean)) semNome = semNome.replace(new RegExp(escRe(nm), 'gi'), ' ');
  if (/\p{Lu}{4,}/u.test(semNome)) erros.push('com palavra em CAIXA ALTA');
  if (/\d/.test(semNome) || /\b(nota|avaliac\w*|estrelas?)\b/.test(norm(semNome))) erros.push('cita nota, avaliações ou estrelas');
  const proib = n.match(ASSUNTO_PROIBIDO_V2);
  if (proib) erros.push(`no padrão antigo ("${proib[0]}")`);
  // Partes fixas exatas; {cidade} = a cidade do lead; {nome} = 1 a 4 palavras, todas do nome real (forma curta, sem inventar).
  const toks = fmt.split(/(\{nome\}|\{cidade\})/)
    .map((p) => (p === '{nome}' ? '(.+?)' : p === '{cidade}' ? escRe(norm(lead.cidade)) : escRe(norm(p)))).filter(Boolean);
  const m = n.match(new RegExp('^' + toks.join(' ') + '$'));
  const doNome = new Set(norm(lead.nome).split(' '));
  const slot = m ? m[1].split(' ').filter((w, i) => !(i === 0 && ['a', 'o', 'as', 'os'].includes(w))) : [];
  if (!m || slot.length < 1 || slot.length > 4 || !slot.every((w) => doNome.has(w))) erros.push(`fora do formato sorteado ("${fmt}")`);
  return erros.map((e) => 'assunto ' + e);
}

// Corpo: curto, em primeira pessoa, observação neutra e pedido de sim ou não, sem reunião nem duração no primeiro toque.
const TERMOS_PROIBIDOS_V2 = [
  [/\blacuna/i, '"lacuna"'], [/\bdificult/i, '"dificulta"'], [/\bresolveria/i, '"resolveria"'],
  [/reuni[ãa]o de diagn[óo]stico/i, '"reunião de diagnóstico"'], [/reuni[ãa]o/i, 'pedido de reunião no primeiro contato'],
  [/\b(\d+|quinze|vinte|trinta|quarenta)\s*(min\b|minutos?)/i, 'duração ("30 minutos")'], [/\bminutos?\b/i, 'duração em minutos'],
  [/gratuit/i, '"gratuita"'], [/\bgostar[íi]a/i, '"Gostaria de"'], [/presen[çc]a digital/i, '"presença digital"'],
  [/\bsites?\b[^.?!\n]{0,30}\bprofissiona/i, '"profissional" como adjetivo de site'],
  [/profissiona\w*\s+(?:\S+\s+)?sites?\b/i, '"profissional" como adjetivo de site'],
  [/^\s*ol[áa]\s*[,!.]?\s*(vi que|equipe)/i, 'abertura antiga ("Olá, vi que" / "Olá, equipe")'],
  [/\p{L}-l[oa]s?(?!\p{L})/iu, 'forma com gênero ("convidá-lo/la/los")'], [/\((?:o|a|os|as|s)\)/i, 'forma com gênero ("(a)")'],
  [/\bprezad[oa]/i, 'forma com gênero ("Prezado")'],
];
// 05/11 (1ª resposta real): o e-mail ofereceu "serviços do pet shop" e "agendamentos" a uma agropecuária (tipo Google
// pet_store/store) e o lead respondeu "não tenho banho e tosa… tenho 2 mil itens". Loja/varejo, pelo tipo do Google:
// falar de produtos, catálogo e WhatsApp; nunca presumir serviços nem agendamento. Tipo principal de serviço vence.
const TIPO_SERVICO_RE = /veterin[aá]ri|cl[ií]nica|oficina|mec[aâ]nic|sal[aã]o|barbear|academia|pilates|escola|autoescola|contab|advoc|advogad|imobili|fisioter|dentist|odonto|est[eé]tic|consult[oó]rio|spa\b/i;
const TIPOS_VAREJO_RE = /(_store$|^store$|^supermarket$|^grocery|^shopping_mall$|^department_store$|^pharmacy$|^drugstore$|^market$)/;
const TIPO_VAREJO_RE = /\b(loja|agropecu|pet ?shop|material de constru|ferrag|mercad|supermercad|boutique|papelaria|distribuidora|atacad|varejo|ra[çc][õo]es|[óo]tica|farm[áa]cia|drogaria)/i;
// Tipo de serviço do Google ao lado do de loja (pet shop com pet_care/veterinary_care = banho e tosa ou veterinário):
// aí o serviço existe segundo o Google e falar dele não é presumir. O tipo genérico "service" não conta.
const TIPOS_SERVICO_RE = /^(pet_care|veterinary_care|beauty_salon|hair_care|spa|car_repair|car_wash|dentist|doctor|physiotherapist|gym|lawyer|accounting|school|driving_school)$/;
// Nichos de serviço: um tipo "Loja"/"store" genérico (sem *_store específico) não basta para tratar como loja
// (amostra de 05/11: escritório de contabilidade e salão marcados só como "Loja" no Google).
const NICHOS_SERVICO = new Set(['odontologia_estetica', 'advocacia', 'estetica_harmonizacao', 'oficina_mecanica', 'salao_barbearia',
  'academia_pilates', 'contabilidade', 'imobiliaria', 'autoescola', 'escola_idiomas', 'fisioterapia', 'dedetizadora']);
function ehVarejo(lead) {
  const tipo = String(lead.tipo_google || '');
  const tipos = (lead.tipos_google || []).map(String);
  if (TIPO_SERVICO_RE.test(tipo) || TIPO_SERVICO_RE.test(String(lead.nome || ''))) return false;
  if (tipos.some((t) => TIPOS_SERVICO_RE.test(t))) return false;
  if (NICHOS_SERVICO.has(lead.nicho) && !tipos.some((t) => /_store$|^supermarket$|^pharmacy$/.test(t))) return false;
  if ((lead.tipos_google || []).some((t) => TIPOS_VAREJO_RE.test(String(t))) || TIPO_VAREJO_RE.test(tipo)) return true;
  // Sem tipo do Google (leads antigos): o nicho da busca decide.
  return !tipo && !(lead.tipos_google || []).length && ['varejo_local', 'material_construcao'].includes(lead.nicho);
}
const SERVICO_EM_LOJA_RE = /\bagend\w*|\bconsultas?\b|\bservi[çc]os?\b|\breserv\w*|banho e tosa|\batendimentos?\b/i;
const PRODUTO_RE = /produt|cat[áa]logo|\bitens\b|mercadoria|estoque|\bpe[çc]as?\b|\bvend(e|em)\b/i;
function checarVarejo(texto, lead, exigeProduto = true) {
  if (!ehVarejo(lead)) return [];
  const erros = [];
  const m = String(texto || '').match(SERVICO_EM_LOJA_RE);
  if (m) erros.push(`presume serviço/agendamento numa loja ("${m[0]}"); fale de produtos, catálogo e WhatsApp`);
  if (exigeProduto && !PRODUTO_RE.test(String(texto || ''))) erros.push('loja sem menção a produtos ou catálogo');
  return erros;
}
function checarCorpoV2(corpo, lead) {
  const erros = [];
  const c = String(corpo || '').trim();
  const L = CONFIG.corpoLimites;
  const palavras = c.split(/\s+/).filter(Boolean).length;
  if (c.length < L.caracteresMin || c.length > L.caracteresMax) erros.push(`com ${c.length} caracteres (fora de ${L.caracteresMin}-${L.caracteresMax})`);
  if (palavras < L.palavrasMin || palavras > L.palavrasMax) erros.push(`com ${palavras} palavras (fora de ${L.palavrasMin}-${L.palavrasMax})`);
  if (c.split(/\n\s*\n/).filter((p) => p.trim()).length > 2) erros.push('com mais de 2 parágrafos');
  // Frases: sem a saudação ("Olá!"), sem o nome da empresa e sem "Dr./Dra." (esse ponto não fecha frase).
  let t = c.replace(/^\s*ol[áa]\s*[!,.]?\s*/i, '');
  if (lead.nome) t = t.replace(new RegExp(escRe(lead.nome), 'gi'), 'X');
  t = t.replace(/\b(dra?|sra?|profa?)\./gi, '$1');
  const frases = (t.match(/[.!?]+(?=\s|$)/g) || []).length;
  if (frases < 3 || frases > 5) erros.push(`com ${frases} frases (fora de 3-5)`);
  for (const [re, nome] of TERMOS_PROIBIDOS_V2) if (re.test(c)) erros.push('contém ' + nome);
  const pessoa = norm(CONFIG.remetente.nomePessoa || '');
  if (!pessoa || !new RegExp(`\\bsou (o|a) ${escRe(pessoa)}\\b`).test(norm(c.slice(0, 120)))) {
    erros.push(`sem primeira pessoa na abertura ("Sou o ${CONFIG.remetente.nomePessoa}")`);
  }
  if (!nomeSugerePlural(lead.nome) && /(^|[^\p{L}])voc[êe]s(?!\p{L})/iu.test(c)) erros.push('trata por "vocês" um nome que não indica mais de uma pessoa (use "você")');
  if (!/\?\s*$/.test(c)) erros.push('não termina com a pergunta de sim ou não');
  erros.push(...checarVarejo(c, lead));
  return erros.map((e) => 'corpo ' + e);
}

// ===== Fase 2: follow-up (prspFollowUp001, 03/11). Regras aprovadas pelo João em 03/11 (ver docs/followup.md). =====
// Dia BRT (YYYY-MM-DD) de um instante; dia útil = seg–sex fora de CONFIG.feriados (nacionais).
const diaBRT = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.agenda.fuso, year: 'numeric', month: '2-digit', day: '2-digit' })
  .format(d instanceof Date ? d : new Date(d));
const ehDiaUtil = (ymd) => {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return dow >= 1 && dow <= 5 && !(CONFIG.feriados || []).includes(ymd);
};
// Dias úteis d com ini < d <= fim (o dia do envio não conta: toque 1 na segunda → D+3 na quinta).
function diasUteisEntre(ini, fim) {
  let n = 0;
  for (let t = Date.parse(`${ini}T12:00:00Z`) + 864e5, f = Date.parse(`${fim}T12:00:00Z`); t <= f; t += 864e5) {
    if (ehDiaUtil(new Date(t).toISOString().slice(0, 10))) n++;
  }
  return n;
}
// Quem recebe toque 2 ou 3 hoje. envios: linhas de prospeccao_envios com lead e contato embutidos.
// Só envios reais (teste=false, status enviado) contam: toques do estágio "teste" não avançam a cadência de produção.
function elegiveisFollowup(envios, leadsComResposta, hoje) {
  const F = CONFIG.followup;
  const porLead = new Map();
  for (const e of envios || []) {
    if (!e || !e.lead_id) continue;
    if (!porLead.has(e.lead_id)) porLead.set(e.lead_id, []);
    porLead.get(e.lead_id).push(e);
  }
  const escolhidos = [], fora = {};
  const pular = (m) => { fora[m] = (fora[m] || 0) + 1; };
  for (const [leadId, es] of porLead) {
    const reais = es.filter((e) => !e.teste && e.status === 'enviado').sort((a, b) => Date.parse(a.enviado_em) - Date.parse(b.enviado_em));
    const inicial = reais.find((e) => e.tipo === 'prospeccao');
    if (!inicial) continue;
    const fus = reais.filter((e) => e.tipo === 'followup');
    const lead = inicial.lead || {}, contato = inicial.contato || {};
    if (leadsComResposta.has(leadId) || es.some((e) => e.resposta_recebida_em)) { pular('respondeu'); continue; }
    if (lead.status !== 'email_enviado') { pular('lead fora de email_enviado'); continue; }
    if (contato.bloqueado || contato.bloqueado_motivo) { pular('contato bloqueado'); continue; }
    if (!inicial.message_id) { pular('sem message_id'); continue; }
    if (lead.retomar_em && Date.parse(lead.retomar_em) > Date.parse(`${hoje}T23:59:59-03:00`)) { pular('retomar depois'); continue; }
    if (fus.length >= 2) { pular('3 toques feitos'); continue; }
    const du1 = diasUteisEntre(diaBRT(inicial.enviado_em), hoje);
    let toque, du2 = null;
    if (fus.length === 0) {
      if (du1 < F.diasToque2) { pular('toque 2 ainda não venceu'); continue; }
      if (du1 > F.maxDiasToque2) { pular(`toque 1 há mais de ${F.maxDiasToque2} dias úteis`); continue; }
      toque = 2;
    } else {
      du2 = diasUteisEntre(diaBRT(fus[0].enviado_em), hoje);
      if (du1 < F.diasToque3 || du2 < F.minDiasEntreToques) { pular('toque 3 ainda não venceu'); continue; }
      toque = 3;
    }
    const pai = fus.length ? fus[fus.length - 1] : inicial;
    escolhidos.push({ lead: { ...lead, id: leadId }, contato, toque, du1, du2, inicial, pai,
      references: [inicial.message_id, ...fus.map((f) => f.message_id)].filter(Boolean),
      anteriores: [inicial.corpo, ...fus.map((f) => f.corpo)].filter(Boolean) });
  }
  // Ordem intercalada (decisão do João, 03/11): um toque 2, um toque 3, alternando; o que sobrar de um tipo vai no fim.
  // Dentro de cada tipo, quem está mais perto de sair da janela primeiro (mais dias úteis desde o toque 1).
  // Com "toque 2 sempre primeiro" o toque 3 nunca saía (simulação 12–30/11: 0 toques 3).
  const porDias = (a, b) => (b.du1 - a.du1) || String(a.lead.id).localeCompare(String(b.lead.id));
  const t2 = escolhidos.filter((e) => e.toque === 2).sort(porDias), t3 = escolhidos.filter((e) => e.toque === 3).sort(porDias);
  const ordem = [];
  for (let i = 0; i < Math.max(t2.length, t3.length); i++) { if (t2[i]) ordem.push(t2[i]); if (t3[i]) ordem.push(t3[i]); }
  return { escolhidos: ordem, fora };
}
// Quantos toques cabem hoje. Sombra: todos os elegíveis são registrados (o teto da sombra só limita textos gerados).
// Teste: CONFIG.followup.tetoTeste (3). 1ª semana ligado (5 dias úteis desde ligadoDesde): tetoSemana1 (6, ajuste do João em
// 03/11). Depois: floor(limite × fracaoLimite). Sempre ≤ espaço que sobra no limite do dia.
function tetoFollowupDia(estagio, limite, enviadosHoje, hoje) {
  const F = CONFIG.followup;
  const espaco = Math.max(0, Number(limite || 0) - Number(enviadosHoje || 0));
  if (estagio === 'sombra') return F.sombraMaxTextos;
  let teto = Math.floor(Number(limite || 0) * F.fracaoLimite);
  if (estagio === 'teste') teto = Math.min(teto, F.tetoTeste);
  else if (!F.ligadoDesde || diasUteisEntre(F.ligadoDesde, hoje) < 5) teto = Math.min(teto, F.tetoSemana1);
  return Math.min(teto, espaco);
}
const URGENCIA_RE = /(últim[ao]s?\s+(chance|dias|vagas|oportunidade)|vagas?\s+limitad|s[óo]\s+hoje|somente\s+hoje|urgente|corr[ae]\b|n[ãa]o\s+perca|tempo\s+limitado|prazo\s+final|promo[çc][ãa]o|desconto|oferta\s+especial)/i;
// Validador do texto do follow-up (2 a 4 frases). Repete as regras de fato/elogio/acento do primeiro e-mail.
// 06/11 — toque 2 com ângulo novo: um exemplo do dia a dia por tipo de negócio e abertura variada (fixa por lead).
function toque2Exemplo(lead, varejo) {
  const t = norm([lead.tipo_google, ...(lead.tipos_google || []), lead.nicho].filter(Boolean).join(' '));
  if (varejo) return 'quem procura um produto à noite ou no fim de semana vê as categorias da loja e chama no WhatsApp para saber se tem e quanto custa; a resposta automática no WhatsApp informa na hora e já recebe o pedido, mesmo com a loja fechada.';
  if (/car_repair|mecanic|oficina|auto ?center|funilaria|car_wash/.test(t)) return 'o cliente com o carro com problema manda no WhatsApp o modelo e o que está acontecendo, recebe resposta na hora (mesmo fora do expediente) e já combina o dia de levar o carro.';
  if (/dentist|odonto|clinic|consultorio|fisioter|estetic|beauty|salao|barbear|hair|spa/.test(t)) return 'quem procura à noite pergunta pelo WhatsApp sobre valores e horários livres, recebe resposta na hora e já deixa o horário marcado, sem esperar o expediente.';
  if (/lawyer|advoc|advogad|accounting|contab|imobili/.test(t)) return 'quem chega com uma dúvida fora do expediente recebe pelo WhatsApp uma primeira orientação e a lista de documentos, e o escritório já recebe o contato organizado.';
  if (/gym|academia|pilates|school|escola|autoescola|idioma/.test(t)) return 'quem quer começar pergunta pelo WhatsApp sobre planos e horários das turmas, recebe resposta na hora e já agenda uma aula experimental.';
  if (/pet_care|veterin|pet/.test(t)) return 'o tutor pergunta pelo WhatsApp, à noite, sobre horários e valores, recebe resposta na hora e já deixa o atendimento marcado.';
  return 'o cliente que encontra a empresa fora do expediente tira as dúvidas pelo WhatsApp e recebe resposta na hora, em vez de procurar o concorrente.';
}
const TOQUE2_ABERTURAS = [
  'comece direto pela situação do dia a dia (por exemplo "Imagine um cliente que…" ou "Pense em quem…").',
  'comece retomando o assunto em poucas palavras (por exemplo "Complementando a minha mensagem," ou "Voltando ao assunto,").',
  'comece pelo benefício concreto, numa frase afirmativa sobre o que o cliente consegue fazer.',
  'comece com uma pergunta curta sobre o dia a dia (por exemplo como chegam as dúvidas fora do horário).',
];
function toque2Abertura(lead) {
  const id = String(lead.id || lead.nome || '');
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TOQUE2_ABERTURAS[h % TOQUE2_ABERTURAS.length];
}
// Regras do João (06/11) para o follow-up.
const SIM_OU_NAO_RE = /\bsim ou n[ãa]o\b/i;
const NOTA_VIRGULA_RE = /\bnota \d+(?:[.,]\d)?\s*,\s*\d+ avalia/i;
const ABERTURA_REPETIDA_RE = /^\s*(ol[áa][!,.]?\s*)?(notei|vi que|reparei|percebi|o perfil)(?!\p{L})/iu;
const REPETE_SEM_SITE_RE = /sem site|perfil (d[aeo] .{1,60} )?no google/i;
function checarCorpoFollowup(corpo, lead, toque, anteriores = []) {
  const F = CONFIG.followup;
  const erros = [];
  const c = String(corpo || '').trim();
  const palavras = c.split(/\s+/).filter(Boolean).length;
  if (palavras < F.palavrasMin || palavras > F.palavrasMax) erros.push(`com ${palavras} palavras (fora de ${F.palavrasMin}-${F.palavrasMax})`);
  let t = c.replace(/^\s*ol[áa]\s*[!,.]?\s*/i, '');
  if (lead.nome) t = t.replace(new RegExp(escRe(lead.nome), 'gi'), 'X');
  t = t.replace(/\b(dra?|sra?|profa?)\./gi, '$1');
  const frases = (t.match(/[.!?]+(?=\s|$)/g) || []).length;
  if (frases < 2 || frases > 4) erros.push(`com ${frases} frases (fora de 2-4)`);
  if (/[\[\]{}]/.test(c)) erros.push('com placeholder entre colchetes/chaves');
  if (/https?:\/\/|www\./i.test(c)) erros.push('com link');
  if (RECUSA_RE.test(c)) erros.push('com texto de recusa/meta-comentário da IA');
  if (URGENCIA_RE.test(c)) erros.push('com urgência falsa ("' + c.match(URGENCIA_RE)[0] + '")');
  for (const [re, nome] of TERMOS_PROIBIDOS_V2) if (re.test(c)) erros.push('contém ' + nome);
  const pessoa = norm(CONFIG.remetente.nomePessoa || '');
  if (pessoa && new RegExp(`\\bsou (o|a) ${escRe(pessoa)}\\b`).test(norm(c))) erros.push('se apresenta de novo (é resposta na mesma conversa)');
  if (!nomeSugerePlural(lead.nome) && /(^|[^\p{L}])voc[êe]s(?!\p{L})/iu.test(c)) erros.push('trata por "vocês" um nome que não indica mais de uma pessoa (use "você")');
  // Sem repetir o toque anterior: nenhum trecho de 6 palavras seguidas igual a um e-mail anterior.
  const janelas = (s) => { const w = norm(s).split(' ').filter(Boolean); const o = new Set(); for (let i = 0; i + 6 <= w.length; i++) o.add(w.slice(i, i + 6).join(' ')); return o; };
  const ant = new Set(anteriores.flatMap((a) => [...janelas(a)]));
  const rep = [...janelas(c)].find((j) => ant.has(j));
  if (rep) erros.push(`repete o e-mail anterior ("${rep}")`);
  if (SIM_OU_NAO_RE.test(c)) erros.push('com "sim ou não"');
  if (NOTA_VIRGULA_RE.test(c)) erros.push('cita a nota como "nota X, N avaliações" (use "nota X com N avaliações")');
  if (toque === 2) {
    if (REPETE_SEM_SITE_RE.test(c)) erros.push('toque 2 repete o argumento do 1º e-mail (perfil no Google sem site)');
    if (ABERTURA_REPETIDA_RE.test(c)) erros.push('toque 2 abre com "Notei que"/"Vi que"/"O perfil" (varie a abertura)');
    if (!/\?\s*$/.test(c)) erros.push('toque 2 não termina com pergunta direta');
  } else if (toque === 3) {
    if (!/(sem problema|tudo bem|fique? à vontade|fica à vontade|não (vou|volto a) insistir|não faz(er)? sentido)/i.test(c)) erros.push('toque 3 sem o encerramento educado');
  }
  erros.push(...checarFatos(c, lead));
  // Follow-up de loja: sem serviço/agendamento (o toque 3 de encerramento não precisa citar produtos).
  erros.push(...checarVarejo(c, lead, false));
  return erros.map((e) => 'corpo ' + e);
}
const uuidV4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
  const r = Math.floor(Math.random() * 16);
  return (ch === 'x' ? r : (r % 4) + 8).toString(16);
});
// E-mail RFC 2822 (multipart/alternative, UTF-8) em base64url para a Gmail API (users.messages.send, campo "raw").
// Mesma conversa: In-Reply-To = Message-ID do toque anterior; References = todos os Message-ID da conversa.
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
const cabecalhoUtf8 = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
function emailRaw({ de, para, assunto, inReplyTo, references, messageId, texto, html }) {
  const fronteira = 'novax-' + uuidV4();
  const quebra = (s) => b64(s).replace(/.{76}/g, '$&\r\n');
  const linhas = [
    `From: ${de}`, `To: ${para}`, `Reply-To: ${CONFIG.remetente.email}`, `Subject: ${cabecalhoUtf8(assunto)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`, `Message-ID: ${messageId}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []), ...(references && references.length ? [`References: ${references.join(' ')}`] : []),
    'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${fronteira}"`, '',
    `--${fronteira}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', quebra(texto),
    `--${fronteira}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', quebra(html),
    `--${fronteira}--`, '',
  ];
  return Buffer.from(linhas.join('\r\n'), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// ---- fim da biblioteca ----
