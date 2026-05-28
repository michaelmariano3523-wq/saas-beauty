import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

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
    const docRef = doc(db, 'settings', 'email');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as EmailConfig;
    }
    return null;
  } catch (error) {
    console.error('Error getting email config:', error);
    return null;
  }
}

// Save email config
export async function saveEmailConfig(config: EmailConfig) {
  try {
    await setDoc(doc(db, 'settings', 'email'), {
      ...config,
      updatedAt: new Date()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving email config:', error);
    throw error;
  }
}

// Get email templates
export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'emailTemplates'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailTemplate));
  } catch (error) {
    console.error('Error getting email templates:', error);
    return [];
  }
}

// Save email template
export async function saveEmailTemplate(template: EmailTemplate) {
  try {
    if (template.id) {
      await setDoc(doc(db, 'emailTemplates', template.id), {
        ...template,
        updatedAt: new Date()
      }, { merge: true });
    } else {
      await setDoc(doc(collection(db, 'emailTemplates')), {
        ...template,
        createdAt: new Date(),
        updatedAt: new Date()
      });
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

    // In real implementation, this would call a Firebase Cloud Function or backend API
    console.log('Sending email:', { to, subject, body, config });
    
    // Simulate API call to cloud function
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
