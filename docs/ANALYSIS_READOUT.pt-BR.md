# Leitura analítica do Clearline

Snapshot: 01/01/2025 a 07/01/2025. O mart contém 74.076 reclamações públicas do CFPB, uma linha por `complaint_id`.

## Resposta executiva

Nos três dias mais recentes, entraram 34.010 reclamações, queda de 1,7% contra 34.613 nos três dias anteriores. A taxa de resposta no prazo permaneceu praticamente estável: 99,565% contra 99,549%. As respostas fora do prazo caíram de 156 para 148, enquanto a cobertura de relatos subiu de 27,38% para 27,69% (+0,31 ponto percentual).

A queda de volume foi explicada principalmente por cobrança de dívidas (-331 reclamações) e cartão de crédito (-170). Relatórios de crédito, apesar de dominarem o volume, caíram apenas 62 registros. Isso indica mudança de mix, não uma melhora geral certificada na experiência do consumidor.

No histórico completo, relatórios de crédito ou outros relatórios pessoais representam 64.786 reclamações, 87,46% do total. Os três maiores produtos concentram 95,57% do volume. Essa concentração torna qualquer leitura geral fortemente dependente do mix de relatórios de crédito.

Existem 320 respostas fora do prazo. Cobrança de dívidas responde por 114 delas (35,6%), relatórios de crédito por 73 (22,8%), empréstimos estudantis por 53 (16,6%) e gestão de dívida/crédito por 34 (10,6%). Juntos, esses quatro produtos representam 85,6% das exceções e formam a fila operacional mais defensável.

## Evidência narrativa

Há 20.330 relatos publicados, cobertura de 27,44%. A ausência de narrativa em 72,56% das reclamações impede tratar os grupos textuais como visão completa da população.

As regras explicáveis classificam 47,57% dos registros como `Credit reporting accuracy`, 34,82% como `Other service issues` e 10,44% como `Identity & fraud`. São grupos de triagem por palavras-chave, não tópicos estatísticos, fatos comprovados ou achados regulatórios. A regra usa o relato quando disponível e o problema estruturado quando não há relato; portanto, diferenças de cobertura textual podem alterar o mix de tópicos.

## Comparação entre empresas

O mart empresa-produto contém somente grupos com pelo menos 25 reclamações. Ele cobre 69.351 registros, 93,62% do total, e 18.002 relatos, 88,55% dos relatos publicados. Totais desse mart não devem ser confundidos com totais da base completa.

Comparações só são válidas dentro do mesmo produto, período e corte mínimo. Mesmo assim, medem comportamento de resposta no processo do CFPB, não qualidade geral da empresa. Não existe denominador de clientes, contas, transações ou exposição de mercado.

## Sequência recomendada

1. Priorizar as 320 exceções fora do prazo, começando pelos quatro produtos que concentram 85,6% delas.
2. Investigar cobrança de dívidas por combinar 114 exceções com taxa de prazo de 97,39%.
3. Tratar empréstimos estudantis e gestão de dívida/crédito como sinais relevantes, mas confirmar estabilidade com uma janela maior que sete dias.
4. Separar volume, taxa de prazo e cobertura narrativa; nenhuma dessas métricas substitui as outras.
5. Usar grupos de tópicos apenas para amostragem e revisão humana dos relatos.
6. Obter denominadores externos antes de calcular taxa de reclamação ou comparar qualidade entre empresas.

## Limitações

A extração cobre apenas sete dias e inclui feriado e fim de semana, insuficiente para sazonalidade, tendência, controle estatístico ou detecção robusta de mudança. O banco do CFPB não é uma amostra estatisticamente representativa. Reclamações são alegações de consumidores, e relatos publicados passam pelo processo de privacidade do CFPB. O painel sustenta triagem operacional; não sustenta causalidade, prevalência ou ranking geral de qualidade.
