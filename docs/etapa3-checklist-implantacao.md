# Etapa 3 — implantação segura do SaaS

## Funcionalidades em desenvolvimento
- Teste por 24h após criação do primeiro espaço de um novo usuário.
- Assinatura mensal (R$ 9,90, 30 dias) e anual (R$ 97,00, 1 ano).
- Pix CNPJ 62.109.951/0001-50 e comprovante via WhatsApp (37) 99662-0552.
- Pagamento nunca é confirmado pelo cliente; apenas por RPC de Super Admin.
- Conta administrativa autorizada somente após identificação do UUID de auth.users correspondente ao e-mail previamente informado pelo responsável.

## Atenção: NÃO rodar em produção nem mesclar antes de testes
- A migração de fundação preserva usuários existentes com legacy_access e NÃO troca o RLS financeiro existente.
- A camada SubscriptionGate ainda precisa ser integrada à versão atual de main: a branch draft divergiu dos commits recentes, inclusive da página /assinatura.
- Validar o schema completo e a consistência dos tipos TypeScript com o banco.
- Conferir 24h pelo horário do servidor; não confiar no relógio do cliente como mecanismo de autorização.
- Testar usuário pré-existente, novo usuário, editor/visualizador, admin e tentativa de acesso indevido.
- Testar plano anual, mensal, renovação antes do vencimento e confirmação duplicada do mesmo Pix.
- Testar ausência de pagamento e nova solicitação enquanto uma está pendente.
- Só habilitar bloqueio efetivo depois de avaliar políticas RLS, funções SECURITY DEFINER e acesso de visualizadores.
- Conferir saldo, reservas e histórico antes/depois de aplicar qualquer migração.
- Exigir conferência do crédito no extrato bancário; comprovante enviado pelo WhatsApp não constitui prova definitiva.

## Ativação manual do Super Admin
O e-mail escolhido pelo proprietário não concede permissão sozinho. Após confirmar a identidade e existir um usuário real em auth.users, um operador com acesso privilegiado ao banco precisa inserir seu UUID em public.saas_admins. Não inserir e-mail no frontend, não criar regra de RLS com e-mail e não expor service_role.
