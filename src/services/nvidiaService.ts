const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'meta-llama/llama-3.1-8b-instruct';

// @ts-ignore - Vite define env
const NVIDIA_API_KEY = (import.meta as any).env?.VITE_NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY || '';

export async function chatWithAI(message: string, context: string, history: { role: string; text: string }[] = []) {
  if (!NVIDIA_API_KEY) {
    return "⚠️ **IA não configurada.** Por favor, configure a variável VITE_NVIDIA_API_KEY no ambiente de deploy para ativar a IA Assistente.";
  }

  try {
    const systemPrompt = `Você é a **IA oficial do KERNEL BEAUTY SHOPPER** — uma plataforma SaaS completa para gestão de salões. Seu PAPEL PRINCIPAL é apresentar, explicar e dar suporte sobre a própria plataforma.

## SUA PERSONALIDADE:
- Profissional, amigável e entusiasmado com o produto
- Tom direto e útil, sempre em PORTUGUÊS BRASILEIRO
- Use listas e emojis com moderação

## IDENTIDADE DA EMPRESA:
KERNEL BEAUTY SHOPPER é um **SaaS de gestão para salões**.
- **CNPJ:** 52.846.879/0001-90
- **Público:** Todos os profissionais — do iniciante ao profissional
- **Propósito:** Digitalizar e automatizar a operação do seu salão
- **Tecnologia:** React + TypeScript + Vite, Supabase, Firebase, Vercel
- **Planos:** Free, Basic, Pro e Enterprise

## MÓDULOS DA PLATAFORMA:
- **Dashboard:** Métricas em tempo real: faturamento, agendamentos, ticket médio, alertas de estoque
- **Agenda Inteligente:** Gerencie agendamentos com status e preços
- **Gestão de Profissionais:** Cadastro com foto, função, avaliação e ranking
- **Controle de Estoque:** Catálogo com alerta automático de estoque baixo
- **Financeiro:** Receita, ticket médio, despesas, lucro e previsão semanal
- **IA Assistente (você!):** Atendimento inteligente sobre a plataforma
- **Planos:** Free, Basic, Pro, Enterprise

## REGRAS:
1. NUNCA invente dados — use apenas o contexto fornecido
2. NUNCA fale inglês — responda sempre em português brasileiro
3. Para agendamentos: informe data, horário, cliente, serviço, profissional, telefone
4. Para estoque: nome do produto, quantidade, criticidade
5. Para financeiro: valores em R$, períodos, comparações
6. Se não tiver dados suficientes, avise claramente

## Contexto atual do salão:
${context}`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ role: msg.role === 'ia' ? 'assistant' : 'user', content: msg.text })),
      { role: 'user', content: message }
    ];

    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
  } catch (error: any) {
    console.error("NVIDIA API Error:", error);

    if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate')) {
      return `⚠️ **Cota da API excedida.**

A chave da API NVIDIA atingiu o limite.

**Soluções:**
1. **Aguarde** - A cota renova em 24 horas
2. **Novos créditos** - Acesse https://build.nvidia.com/ para mais créditos
3. **Plano pago** - Ative o billing na NVIDIA para limites maiores

Ainda pode usar todo o sistema normalmente, apenas a IA está temporariamente indisponível.`;
    }

    if (error.message?.includes('401') || error.message?.includes('auth')) {
      return "⚠️ **API Key inválida.** Verifique se a VITE_NVIDIA_API_KEY está correta no ambiente de deploy.";
    }

    return "Desculpe, tive um problema ao processar sua solicitação. Tente novamente mais tarde.";
  }
}
