import { supabase } from './supabaseClient';

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
}

export interface EmailTemplate {
  id?: string;
  type: 'welcome' | 'password_reset' | 'subscription_confirmed' | 'payment_failed' | 'trial_ending';
  subject: string;
  body: string;
  variables: string[]; // e.g., {{name}}, {{plan}}, {{price}}
  isActive: boolean;
}

// Get email config
export async function getEmailConfig(): Promise<EmailConfig | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'email')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as EmailConfig || null;
  } catch (error) {
    console.error('Error getting email config:', error);
    return null;
  }
}

// Save email config
export async function saveEmailConfig(config: EmailConfig) {
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({
        id: 'email',
        ...config,
        updatedAt: new Date().toISOString()
      }, { onConflict: ['id'] });
      
    if (error) throw error;
  } catch (error) {
    console.error('Error saving email config:', error);
    throw error;
  }
}

// Get email templates
export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('emailTemplates')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error && error.code !== 'PGRST116') throw error;
    return (data as EmailTemplate[]) || [];
  } catch (error) {
    console.error('Error getting email templates:', error);
    return [];
  }
}

// Save email template
export async function saveEmailTemplate(template: EmailTemplate) {
  try {
    if (template.id) {
      const { error } = await supabase
        .from('emailTemplates')
        .update({
          ...template,
          updatedAt: new Date().toISOString()
        })
        .eq('id', template.id);
        
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('emailTemplates')
        .insert({
          ...template,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
      if (error) throw error;
    }
  } catch (error) {
    console.error('Error saving email template:', error);
    throw error;
  }
}

// Simulate sending email (in production, this would call a cloud function)
export async function sendEmail(to: string, templateType: string, variables: Record<string, string>) {
  try {
    const config = await getEmailConfig();
    if (!config?.enabled) {
      console.log('Email sending disabled');
      return { success: false, message: 'Email disabled' };
    }

    const templates = await getEmailTemplates();
    const template = templates.find(t => t.type === templateType && t.isActive);
    if (!template) {
      throw new Error(`Template not found: ${templateType}`);
    }

    let body = template.body;
    let subject = template.subject;
    
    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      body = body.replace(regex, value);
      subject = subject.replace(regex, value);
    });

     // Simulate API call to backend function
     console.log('Sending email:', { to, subject, body, config });
     
     // Call backend API to send email
     const response = await fetch('/api/send-email', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ to, subject, body, config })
     });

    return await response.json();
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Predefined templates
export const defaultTemplates: Omit<EmailTemplate, 'id'>[] = [
  {
    type: 'welcome',
    subject: 'Bem-vindo à Kernel Beauty SaaS, {{name}}!',
    body: `Olá {{name}},

Bem-vindo à Kernel Beauty SaaS! Sua conta foi criada com sucesso.

Detalhes da sua assinatura:
- Plano: {{plan}}
- Valor: {{price}}
- Status: {{status}}

Acesse agora: {{login_url}}

Equipe Kernel Beauty`,
    variables: ['name', 'plan', 'price', 'status', 'login_url'],
    isActive: true
  },
  {
    type: 'password_reset',
    subject: 'Recuperação de Senha - Kernel Beauty',
    body: `Olá {{name}},

Você solicitou a recuperação de senha. Clique no link abaixo para redefinir:

{{reset_url}}

Este link expira em 1 hora.

Se você não solicitou, ignore este email.`,
    variables: ['name', 'reset_url'],
    isActive: true
  },
  {
    type: 'subscription_confirmed',
    subject: 'Assinatura Confirmada - {{plan}}',
    body: `Parabéns {{name}}!

Sua assinatura do plano {{plan}} foi confirmada com sucesso.

Valor: {{price}}/mês
Próxima cobrança: {{next_billing_date}}

Obrigado por escolher a Kernel Beauty!`,
    variables: ['name', 'plan', 'price', 'next_billing_date'],
    isActive: true
  },
  {
    type: 'payment_failed',
    subject: 'Falha no Pagamento - Kernel Beauty',
    body: `Olá {{name}},

Houve uma falha ao processar seu pagamento do plano {{plan}}.

Motivo: {{failure_reason}}

Por favor, atualize seus dados de pagamento: {{update_payment_url}}`,
    variables: ['name', 'plan', 'failure_reason', 'update_payment_url'],
    isActive: true
  },
  {
    type: 'trial_ending',
    subject: 'Seu período de teste está acabando!',
    body: `Olá {{name}},

Seu período de teste do plano {{plan}} termina em {{trial_end_date}}.

Para continuar usando, escolha um plano: {{pricing_url}}`,
    variables: ['name', 'plan', 'trial_end_date', 'pricing_url'],
    isActive: true
  }
];
