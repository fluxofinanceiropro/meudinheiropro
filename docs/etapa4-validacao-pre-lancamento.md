# Etapa 4 — Plano de testes antes da venda

**Estado atual:** roteiro preparado; os testes de integração com banco, login e pagamentos AINDA NÃO foram executados nem aprovados.

## Cenários obrigatórios de validação em ambiente de testes

| ID | Cenário | Critério para aprovação |
|---|---|---|
| T01 | Cadastro de novo cliente | Primeiro espaço inicia trial com horário do servidor; 24h únicas por titular |
| T02 | Relógio regressivo | Mostra tempo restante; recarregar a página não reinicia o prazo |
| T03 | Expiração | Usuário expirado vê pagamento; dados continuam preservados |
| T04 | Mensal | Solicitação registra R$ 9,90; sem acesso extra antes da aprovação |
| T05 | Anual | Solicitação registra R$ 97,00; sem acesso extra antes da aprovação |
| T06 | WhatsApp | Abre 5537996620552 com o plano e valor corretos; comprovante é anexado pelo próprio cliente |
| T07 | Permissão administrativa | Usuário comum não acessa dados, RPCs nem confirmação do admin |
| T08 | Confirmação mensal | Com Pix verificado no extrato, admin libera 30 dias uma única vez |
| T09 | Confirmação anual | Com Pix verificado no extrato, admin libera 1 ano uma única vez |
| T10 | Clique duplicado/repetição | Mesmo pedido nunca concede dois períodos |
| T11 | Renovação antecipada | Soma prazo contratado ao vencimento pago anterior |
| T12 | Pedido duplicado ou plano trocado | Responde claramente; não confirma o plano errado |
| T13 | Usuário antigo | Não perde acesso nem informações quando o SaaS for implantado |
| T14 | Membro editor | Pode editar somente o espaço autorizado e vigente |
| T15 | Membro visualizador | Não altera dados, mesmo utilizando API direta |
| T16 | Isolamento entre espaços | Proprietário A não consegue consultar ou editar dados de B |
| T17 | Novo lançamento e cancelamento | Saldo, extrato e relatórios concordam |
| T18 | Receita com 10% na reserva | Saldo bancário não duplica desconto; reserva é correta |
| T19 | Editar/excluir receita com reserva | Reserva vinculada é reconciliada |
| T20 | Ajustar duas contas com erro na segunda | Nenhum ajuste parcial é salvo |
| T21 | Mais de 500 movimentações | Histórico, filtros, resumo, relatórios e CSV completos |
| T22 | Sem conexão/reenvio | Não duplica transações nem confirma Pix indevidamente |
| T23 | Smartphone e desktop | Menu, botões e telas utilizáveis, sem travamento |
| T24 | Segurança | Sessão encerrada e usuários não-admin têm acesso negado por RLS/RPC |

## Execução e evidências

1. Trabalhar em cópia de teste; NÃO usar pagamentos reais nem expirar assinaturas existentes.
2. Usar pelo menos 4 usuários fictícios (owner, editor, viewer e admin de teste).
3. Rodar `npm ci`, `npm run lint`, `npm test`, `npm run build`.
4. Registrar aprovação/reprovação e evidência (captura de tela, log sem dados pessoais, horário UTC) para cada T01–T24.
5. Não publicar ou habilitar bloqueio de acesso enquanto houver falha crítica ou teste não executado.
6. Aprovar as migrations pendentes da etapa 1 e as migrations SaaS antes de fazer testes reais de integração.
7. Revisar endpoint /admin e autenticação da conta administrativa antes de qualquer lançamento comercial.

## Pendências conhecidas
- PR #14: transação atômica e sincronização da reserva ainda dependem de migração e testes.
- PR #9: SaaS completo está em rascunho; não ativar o gate em produção.
- Esta etapa não certifica o SaaS como pronto para venda; documenta os testes e adiciona regressões unitárias.
