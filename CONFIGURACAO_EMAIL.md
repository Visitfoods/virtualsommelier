# 🔧 Configuração de Email - Resolução do Erro 500

## ❌ **Problema Atual:**
Erro 500 ao enviar pedidos de orçamento - variáveis SMTP não configuradas.

## ✅ **Solução Imediata:**

### 1. **Criar ficheiro `.env.local` na raiz do projeto:**

```bash
# Configuração SMTP para envio de emails
SMTP_HOST=smtp.visitchat.info
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=orcamento@visitchat.info
SMTP_PASS=password-do-email-orcamento
```

### 2. **Modo de Desenvolvimento (Atual):**
- ✅ **Funciona sem SMTP** configurado
- ✅ **Logs no console** do servidor
- ✅ **Dados completos** mostrados
- ✅ **Não quebra** o formulário

### 3. **Para Produção:**
- Configure as credenciais SMTP reais
- Sistema enviará emails reais
- Email central + reencaminhamento funcionará

## 🧪 **Como Testar Agora:**

1. **Submeter formulário** no frontend
2. **Verificar console** do servidor (terminal)
3. **Dados aparecem** nos logs
4. **Formulário funciona** sem erro

## 📋 **Logs Esperados:**

```
⚠️ SMTP não configurado - usando modo de desenvolvimento
📬 Emails de destino: [emails configurados no backoffice]
📋 Dados do Formulário: {nome: "João", email: "joao@email.com", ...}
📍 Guia: Nome do Guia, slug-do-guia
```

## 🎯 **Próximos Passos:**

1. **Testar** o formulário (deve funcionar agora)
2. **Configurar SMTP** quando necessário
3. **Emails reais** serão enviados automaticamente

