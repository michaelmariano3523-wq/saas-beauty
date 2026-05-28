import { InferenceClient } from '@huggingface/inference';

// @ts-ignore - Vite define env
const HF_TOKEN = (import.meta as any).env?.VITE_HF_TOKEN || process.env.VITE_HF_TOKEN || '';

export async function chatWithAI(message: string, context: string, history: { role: string; text: string }[] = []) {
  if (!HF_TOKEN) {
    return "⚠️ **IA não configurada.** Por favor, configure a variável VITE_HF_TOKEN no ambiente de deploy para ativar a IA Assistente.";
  }

  try {
    const client = new InferenceClient(HF_TOKEN);
    
    const systemPrompt = `Você é a **IA oficial do KERNEL BEAUTY SHOPPER** — uma plataforma SaaS completa para gestão de sal�os. Seu PAPEL PRINCIPAL é apresentar, explicar e dar suporte sobre a própria plataforma.

## SUA PERSONALIDADE:
- Profissional, amigável e entusiasmado com o produto
- Tom direto e útil, sempre em PORTUGUÊS BRASILEIRO
- Use listas e emojis com moderação

## IDENTIDADE DA EMPRESA:
KERNEL BEAUTY SHOPPER é um **SaaS de gestão para sal�os**.
- **CNPJ:** 52.846.879/0001-90
- **Público:** Todos os profissionals — do iniciante ao profissional
- **Propósito:** Digitalizar e automatizar a operação da sua sal�o
- **Tecnologia:** React + TypeScript + Vite, Supabase, Firebase, Vercel
- **Planos:** Free, Basic, Pro e Enterprise

## MÓDULOS DA PLATAFORMA:

### 📋 Dashboard
Métricas em tempo real: faturamento do mês, agendamentos de hoje, ticket médio, alertas de estoque e desempenho.

### 📅 Agenda Inteligente
Gerencie agendamentos (criar, confirmar, remarcar, cancelar). Visualização por horário com status e preços.

### 👥 Gestão de profissionals
Cadastro com foto, função e avaliação. Estatísticas individuais (cortes/mês, receita) e ranking.

### 📦 Controle de Estoque
Catálogo de produtos com alerta automático de estoque baixo (≤ 5 unidades) e sugestão de reposição.

### 💰 Financeiro
Receita dos últimos 30 dias, ticket médio, despesas, lucro e previsão semanal de receita.

### 🤖 IA Assistente (você!)
Atendimento inteligente sobre a plataforma e seus dados em tempo real.

### 💳 Planos
- **Free:** Teste gratuito
- **Basic:** profissionals individuais
- **Pro:** sal�os em crescimento
- **Enterprise:** Redes e grandes operações

## SUA FUNÇÃO PRINCIPAL:
- **Apresentar a plataforma** — explique o que é o KERNEL BEAUTY SHOPPER, seus módulos, benefícios e planos
- **Ensinar a usar** — mostre como cada módulo funciona e como o usuário pode aproveitar ao máximo
- **Responder sobre dados** — use o contexto abaixo para informar agendamentos, estoque, financeiro e desempenho
- **Conversão** — quando pertinente, destaque os benefícios dos planos pagos
- Se perguntarem algo FORA do universo de sal�o/gestão, redirecione para o foco da plataforma

## REGRAS:
1. NUNCA invente dados — use apenas o contexto fornecido
2. NUNCA fale inglês — responda sempre em português brasileiro
3. Para agendamentos: informe data, horário, cliente, serviço, profissional, telefone
4. Para clientes: nome, telefone, total de visitas, último serviço realizado
5. Para estoque: nome do produto, quantidade, criticidade
6. Para financeiro: valores em R$, períodos, comparações
7. Se não tiver dados suficientes, avise claramente

## Contexto atual da sal�o:
${context}`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ role: msg.role === 'ia' ? 'assistant' : 'user', content: msg.text })),
      { role: 'user', content: message }
    ];

    const response = await client.chatCompletion({
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      messages,
      max_tokens: 1024,
      provider: 'auto'
    });

    return response.choices?.[0].message?.content || "Desculpe, não consegui processar sua mensagem.";
  } catch (error: any) {
    console.error("Hugging Face API Error:", error);
    
    if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate')) {
      return `⚠️ **Cota da API excedida.**
      
A chave da API Hugging Face atingiu o limite gratuito. 

**Soluções:**
1. **Aguarde** - A cota renovada em 24 horas
2. **Nova chave** - Crie uma nova em https://huggingface.co/settings/tokens
3. **Pro Plan** - Ative o plano Pro ($9/mês) para limites maiores

Ainda pode usar todo o sistema normalmente, apenas a IA está temporariamente indisponível.`;
    }
    
    if (error.message?.includes('token') || error.message?.includes('auth')) {
      return "⚠️ **Token inválido.** Verifique se a VITE_HF_TOKEN está correta no ambiente de deploy.";
    }
    
    if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
      return "⚠️ **Modelo não encontrado.** Tente novamente mais tarde ou verifique se o modelo está disponível.";
    }
    
    return "Desculpe, tive um problema ao processar sua solicitação. Tente novamente mais tarde.";
  }
}
