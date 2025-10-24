# Configuração SMTP para Envio de Emails

## Sistema de Email Direto

**Funcionamento:**
- ✅ **Emails de destino:** Configurados no backoffice por guia
- ✅ **Envio direto:** Emails vão apenas para os endereços configurados no backoffice
- ✅ **Sem email central:** Não há mais email central obrigatório

## Variáveis de Ambiente Necessárias

Adicione as seguintes variáveis ao seu ficheiro `.env.local`:

```bash
# Configuração SMTP para envio de emails
SMTP_HOST=smtp.visitchat.info  # ou servidor SMTP do domínio
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=orcamento@visitchat.info
SMTP_PASS=password-do-email-orcamento
```

## Configuração para Gmail

1. **Ativar autenticação de 2 fatores** na sua conta Google
2. **Gerar uma password de aplicação**:
   - Ir a: https://myaccount.google.com/security
   - Selecionar "Senhas de app"
   - Gerar nova password para "Mail"
   - Usar essa password no `SMTP_PASS`

## Configuração para Outros Provedores

### Outlook/Hotmail
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Yahoo
```bash
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Servidor SMTP Personalizado
```bash
SMTP_HOST=seu-servidor-smtp.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@dominio.com
SMTP_PASS=sua-password
```

## Teste da Configuração

Após configurar as variáveis, reinicie o servidor e teste o envio de um pedido de orçamento.

## Sistema de Envio Direto

**Emails de Destino:**
- Configurados no backoffice por guia
- Recebem emails diretamente
- Separados por vírgula: `operador1@empresa.com, operador2@empresa.com`

**Vantagens:**
- ✅ **Envio direto:** Emails vão apenas para quem deve receber
- ✅ **Configuração flexível:** Cada guia pode ter emails diferentes
- ✅ **Sem spam:** Não há emails desnecessários
