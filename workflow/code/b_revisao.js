// Salvaguarda 2: IA falhou/recusou após todas as tentativas → lead vai p/ revisão manual (nunca envia e-mail malformado).
const j = $input.first().json;
const cotaEsgotada = j.cota_esgotada || (j.ok === false && j.tentativa === undefined);
const lead = j.lead || $('Loop leads').first().json;
const motivo = cotaEsgotada
  ? 'cota diária da OpenRouter esgotada'
  : `IA inválida após ${j.tentativa} tentativa(s) [${j.tipo_falha}]: ${j.erro}`;
return [{ json: {
  lead,
  lead_patch: { status: 'revisao_manual', motivo_revisao: motivo.slice(0, 500) },
  trello_lista: CONFIG.trello.revisaoManual,
  trello_nome: `[REVISÃO] ${lead.nome} — ${lead.cidade}/${lead.estado}`,
  trello_desc: [`**Motivo:** ${motivo}`, `**Modelo:** ${j.modelo || '-'}`, `**Google Maps:** ${lead.google_maps_url || '-'}`,
                '', '**Última resposta bruta da IA:**', '```', String(j.raw || '').slice(0, 2500), '```'].join('\n'),
} }];
