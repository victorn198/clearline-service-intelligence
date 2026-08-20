import type { Lang } from './types'

export const ui = {
  en: { overview: 'Service Command', filters: 'Evidence scope', channel: 'Product', device: 'Company', country: 'State', all: 'All', reset: 'Restore evidence view', source: 'Official source', finding: 'Evidence statement', action: 'Operational response', prior: 'vs. prior window', details: 'Evidence detail', contact: 'Discuss a similar project', trust: 'Data Trust' },
  pt: { overview: 'Comando de Atendimento', filters: 'Escopo das evidências', channel: 'Produto', device: 'Empresa', country: 'Estado', all: 'Todos', reset: 'Restaurar visão de evidências', source: 'Fonte oficial', finding: 'Conclusão sustentada', action: 'Resposta operacional', prior: 'vs. janela anterior', details: 'Detalhe das evidências', contact: 'Conversar sobre um projeto similar', trust: 'Confiança dos dados' },
} satisfies Record<Lang, Record<string, string>>
