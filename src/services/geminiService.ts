import { GoogleGenAI } from "@google/genai";

// @ts-ignore - Vite define env
const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function chatWithAI(message: string, context: string, history: { role: string; text: string }[] = []) {
  if (!ai) {
    return "⚠️ **IA não configurada.** Por favor, configure a variável VITE_GEMINI_API_KEY no ambiente de deploy para ativar a IA Assistente.";
  }

  try {
    const historyText = history.map(msg => `${msg.role === 'ia' ? 'Assistant' : 'User'}: ${msg.text}`).join('\n');

    const response = await ai.models.generateContent({
      model: "gemini-pro",
      contents: `
        You are the **official AI assistant of KERNEL BEAUTY SHOPPER** — a complete SaaS platform for beautysalon management. Your MAIN ROLE is to present, explain, and support the platform itself.

        ## COMPANY IDENTITY:
        KERNEL BEAUTY SHOPPER is a **management SaaS for beautysalons**.
        - CNPJ: 52.846.879/0001-90
        - Audience: All barbers — from beginners to professionals
        - Purpose: Digitalize and automate your beautysalon operations
        - Tech: React + TypeScript + Vite, Supabase, Firebase, Vercel
        - Plans: Free, Basic, Pro, Enterprise

        ## PLATFORM MODULES:
        - **Dashboard:** Real-time metrics (monthly revenue, today's appointments, average ticket, stock alerts, professional performance)
        - **Smart Agenda:** Full appointment management with status tracking and pricing
        - **Professional Management:** Profiles with photos, ratings, monthly stats, performance ranking
        - **Inventory Control:** Product catalog with auto low-stock alerts (≤ 5 units) and restock suggestions
        - **Financial:** 30-day revenue, average ticket, expenses, profit, weekly forecast
        - **AI Assistant (you!)** — intelligent support about the platform and its data
        - **Plans:** Free (trial), Basic (individual), Pro (growth), Enterprise (chains)

        ## YOUR MAIN ROLE:
        - **Introduce the platform** — explain what KERNEL BEAUTY SHOPPER is, its modules, benefits, and plans
        - **Teach how to use it** — show how each module works and how to get the most out of it
        - **Answer with data** — use the context below to inform about appointments, stock, finances, and performance
        - **Conversion** — when relevant, highlight the benefits of paid plans
        - If asked something OUTSIDE the beautysalon/management universe, redirect to the platform's focus

        ## RULES:
        1. NEVER invent data — use only the provided context
        2. NEVER speak English — always respond in Brazilian Portuguese
        3. For appointments: include date, time, client, service, professional
        4. For stock: product name, quantity, severity
        5. For financial: values in R$, periods, comparisons
        6. If insufficient data, clearly state it

        Current Shop Context:
        ${context}
        
        Conversation history:
        ${historyText || 'No previous messages.'}
        
        User message: "${message}"
        
        Response guidelines:
        - Be professional, helpful, and enthusiastic about the product.
        - Use Markdown for bolding important info.
      `
    });
    
    return response.text || "Desculpe, não consegui processar sua mensagem.";
  } catch (error: any) {
    console.error("AI Error:", error);
    
    // Check for quota exceeded error
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('quota')) {
      return `⚠️ **Cota da API excedida.**

A chave da API Gemini atingiu o limite gratuito. 

**Soluções:**
1. **Aguarde** - A cota renovada em 24 horas
2. **Nova chave** - Crie uma nova em https://aistudio.google.com/apikey
3. **Billing** - Ative o faturamento no Google Cloud para limites maiores

Ainda pode usar todo o sistema normalmente, apenas a IA está temporariamente indisponível.`;
    }
    
    if (error.message?.includes('API key not valid')) {
      return "⚠️ **API Key inválida.** Verifique se a VITE_GEMINI_API_KEY está correta no ambiente de deploy.";
    }
    
    return "Desculpe, tive um problema ao processar sua solicitação. Tente novamente mais tarde.";
  }
}
