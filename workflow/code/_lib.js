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
  const slugs = [...new Set([palavras.join(''), semConectivos.join('')])];
  const out = [];
  for (const s of slugs) out.push(`${s}@gmail.com`, `contato.${s}@gmail.com`);
  return out.filter((e) => emailIdentificaEmpresa(e, nome, cidade));
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
  return erros.map((e) => 'corpo ' + e);
}
// ---- fim da biblioteca ----
