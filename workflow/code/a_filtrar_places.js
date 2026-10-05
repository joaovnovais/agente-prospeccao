// Passo 2: mantém só PMEs operando, SEM website, fora da lista de exclusão (leads manuais em andamento).
const excluida = (nome, endereco) => {
  const n = ' ' + norm(nome) + ' ';
  const ne = ' ' + norm(nome + ' ' + (endereco || '')) + ' ';
  return CONFIG.exclusoes.some((e) =>
    (e.nome || []).every((t) => n.includes(' ' + t + ' ')) &&
    (e.nomeOuEndereco || []).every((t) => ne.includes(' ' + t + ' ')));
};

const vistos = new Set();
const rows = [];
const excluidos = [];
const erros = [];
const itens = $input.all();

itens.forEach((it, i) => {
  const ctx = $('Montar buscas da semana').itemMatching(i).json;
  if (it.json.error) { erros.push(`${ctx.textQuery}: ${JSON.stringify(it.json.error).slice(0, 200)}`); return; }
  for (const p of it.json.places || []) {
    if (!p.id || vistos.has(p.id)) continue;
    vistos.add(p.id);
    if (p.websiteUri) continue;
    if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue;
    const nome = p.displayName?.text || '';
    if (!nome) continue;
    if (excluida(nome, p.formattedAddress)) { excluidos.push(nome); continue; }
    if (ctx.nicho === 'advocacia') {
      const perfil = classificarAdvocacia(nome);
      if (perfil === 'pessoa_fisica' || perfil === 'entidade') { excluidos.push(`${nome} [fora do perfil: ${perfil}]`); continue; }
    }
    rows.push({
      place_id: p.id,
      nome,
      nome_normalizado: norm(nome),
      nicho: ctx.nicho,
      cidade: ctx.cidade,
      estado: ctx.estado,
      endereco: p.formattedAddress || null,
      telefone: p.nationalPhoneNumber || null,
      google_maps_url: p.googleMapsUri || null,
      rating: p.rating ?? null,
      total_avaliacoes: p.userRatingCount ?? null,
      semana_ciclo: ctx.semana_ciclo,
      status: 'novo',
    });
  }
});

if (itens.length && erros.length === itens.length) {
  throw new Error('Places API falhou em todas as buscas. Primeiro erro: ' + erros[0]);
}
return [{ json: { rows, total: rows.length, excluidos, erros } }];
