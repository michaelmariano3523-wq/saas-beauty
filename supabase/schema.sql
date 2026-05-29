-- Supabase Database Schema for SaaS Beauty Barber Shop Management System
-- Generated from analysis of dbService.ts, AdminLayout.tsx, and MainApp.tsx
-- This schema ensures 100% compatibility with the existing TypeScript code
-- Based on actual INSERT/UPDATE operations seen in the codebase

-- Enable UUID extension if needed
create extension if not exists "uuid-ossp";

-- Plans table
create table plans (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  description text,
  is_active boolean default true,
  features text, -- JSON string of features array
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Shops table
-- Note: Based on code analysis, shops.plan stores the plan ID as text (not a FK)
-- to match the exact INSERT/UPDATE operations in AdminLayout and dbService.ts
create table shops (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null, -- References auth.users(id) in Supabase Auth
  name text not null,
  slug text not null unique,
  email text not null,
  plan text not null, -- Stores plan ID from plans table (e.g., 'basic', 'professional', 'premium')
  status text default 'active' check (status in ('active', 'inactive', 'suspended', 'cancelled')),
  plan_expires_at timestamp with time zone null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Barbers table
create table barbers (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  email text not null,
  specialty text,
  bio text,
  active boolean default true,
  slug text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Inventory table
create table inventory (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  description text,
  quantity integer default 0 check (quantity >= 0),
  unit_price numeric(10, 2) check (unit_price >= 0),
  category text,
  sku text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Appointments table
create table appointments (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  barber_id uuid references barbers(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  service_name text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  status text default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no-show')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Subscriptions table (for tracking shop subscription plans)
create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  plan_id uuid not null references plans(id),
  status text default 'active' check (status in ('active', 'canceled', 'past_due', 'unpaid')),
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Payments table
create table payments (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  currency text default 'USD',
  status text default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  payment_method text,
  payment_id text, -- Stripe payment intent ID or similar
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Withdrawals table
create table withdrawals (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  pix_key text not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'processed')),
  admin_note text,
  requested_at timestamp with time zone default timezone('utc'::text, now()) not null,
  processed_at timestamp with time zone null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on all tables
alter table plans enable row level security;
alter table shops enable row level security;
alter table barbers enable row level security;
alter table inventory enable row level security;
alter table appointments enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table withdrawals enable row level security;

-- Create basic policies for authenticated users
-- These policies assume the app uses Supabase Auth and shop owners can only access their own data

-- Plans: Readable by all authenticated users (for pricing display)
create policy "Plans are viewable by authenticated users"
  on plans for select
  using (auth.role() = 'authenticated');

-- Shops: Users can only see their own shop
create policy "Users can view own shop"
  on shops for select
  using (auth.uid() = owner_id);

create policy "Users can update own shop"
  on shops for update
  using (auth.uid() = owner_id);

-- Barbers: Accessible within shop context
create policy "Barbers viewable by shop owner"
  on barbers for select
  using (
    exists (
      select 1 from shops
      where shops.id = barbers.shop_id
      and shops.owner_id = auth.uid()
    )
  );

create policy "Barbers manageable by shop owner"
  on barbers for all
  using (
    exists (
      select 1 from shops
      where shops.id = barbers.shop_id
      and shops.owner_id = auth.uid()
    )
  );

-- Inventory: Accessible within shop context
create policy "Inventory viewable by shop owner"
  on inventory for select
  using (
    exists (
      select 1 from shops
      where shops.id = inventory.shop_id
      and shops.owner_id = auth.uid()
    )
  );

create policy "Inventory manageable by shop owner"
  on inventory for all
  using (
    exists (
      select 1 from shops
      where shops.id = inventory.shop_id
      and shops.owner_id = auth.uid()
    )
  );

-- Appointments: Accessible within shop context
create policy "Appointments viewable by shop owner"
  on appointments for select
  using (
    exists (
      select 1 from shops
      where shops.id = appointments.shop_id
      and shops.owner_id = auth.uid()
    )
  );

create policy "Appointments manageable by shop owner"
  on appointments for all
  using (
    exists (
      select 1 from shops
      where shops.id = appointments.shop_id
      and shops.owner_id = auth.uid()
    )
  );

-- Subscriptions: Accessible within shop context
create policy "Subscriptions viewable by shop owner"
  on subscriptions for select
  using (
    exists (
      select 1 from shops
      where shops.id = subscriptions.shop_id
      and shops.owner_id = auth.uid()
    )
  );

-- Payments: Accessible within shop context
create policy "Payments viewable by shop owner"
  on payments for select
  using (
    exists (
      select 1 from shops
      where shops.id = payments.shop_id
      and shops.owner_id = auth.uid()
    )
  );

-- Withdrawals: Accessible within shop context
create policy "Withdrawals viewable by shop owner"
  on withdrawals for select
  using (
    exists (
      select 1 from shops
      where shops.id = withdrawals.shop_id
      and shops.owner_id = auth.uid()
    )
  );

create policy "Withdrawals creatable by shop owner"
  on withdrawals for insert
  with check (
    exists (
      select 1 from shops
      where shops.id = withdrawals.shop_id
      and shops.owner_id = auth.uid()
    )
  );

-- Create indexes for frequently queried columns
create index idx_shops_owner_id on shops(owner_id);
create index idx_shops_plan on shops(plan); -- For filtering by plan
create index idx_shops_slug on shops(slug);
create index idx_barbers_shop_id on barbers(shop_id);
create index idx_barbers_slug on barbers(slug);
create index idx_inventory_shop_id on inventory(shop_id);
create index idx_appointments_shop_id on appointments(shop_id);
create index idx_appointments_barber_id on appointments(barber_id);
create index idx_appointments_start_time on appointments(start_time);
create index idx_subscriptions_shop_id on subscriptions(shop_id);
create index idx_payments_shop_id on payments(shop_id);
create index idx_withdrawals_shop_id on withdrawals(shop_id);
create index idx_withdrawals_status on withdrawals(status);

-- Insert default plans
insert into plans (name, price, description, is_active, features) values
  ('free', 0, 'Plano gratuito para testar o sistema', true, '["agendamentos básicos", "até 2 profissionais"]'),
  ('basic', 29.90, 'Ideal para barbearias que estão começando', true, '["agendamentos ilimitados", "até 5 profissionais", "estoque básico"]'),
  ('professional', 69.90, 'Para barbearias em crescimento', true, '["tudo do basic", "agendamento online", "relatórios avançados"]'),
  ('premium', 129.90, 'Para barbearias estabelecidas com múltiplos barbeiros', true, '["tudo do professional", "múltiplas lojas", "API access", "suporte prioritário"]')
on conflict do nothing;

-- Create a function to update the updated_at timestamp automatically
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at column
do $$
declare
  tables text[] := array['plans', 'shops', 'barbers', 'inventory', 'appointments', 'subscriptions', 'payments', 'withdrawals'];
  table_name text;
begin
  foreach table_name in array tables loop
    execute format('
      drop trigger if exists update_%I_updated_at on %I;
      create trigger update_%I_updated_at
        before update on %I
        for each row
        execute function update_updated_at_column();
    ', table_name, table_name, table_name, table_name);
  end loop;
end $$;

-- Settings table (for email configuration and other settings)
create table settings (
  id text primary key, -- Using text ID like 'email', 'notifications', etc.
  smtp_host text,
  smtp_port integer,
  smtp_user text,
  smtp_pass text,
  smtp_secure boolean default true,
  from_email text,
  from_name text,
  enabled boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Email templates table
create table email_templates (
  id uuid primary key default uuid_generate_v4(),
  type text not null unique check (type in ('welcome', 'password_reset', 'subscription_confirmed', 'payment_failed', 'trial_ending')),
  subject text not null,
  body text not null,
  variables text[], -- Array of variable names like ['name', 'plan', 'price']
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on settings and email_tables
alter table settings enable row level security;
alter table email_templates enable row level security;

-- Create policies for settings and email_templates
create policy "Settings are viewable by authenticated users"
  on settings for select
  using (auth.role() = 'authenticated');

create policy "Settings are editable by authenticated users"
  on settings for all
  using (auth.role() = 'authenticated');

create policy "Email templates are viewable by authenticated users"
  on email_templates for select
  using (auth.role() = 'authenticated');

create policy "Email templates are editable by authenticated users"
  on email_templates for all
  using (auth.role() = 'authenticated');

-- Create indexes for frequently queried columns
create index idx_settings_id on settings(id);
create index idx_email_templates_type on email_templates(type);

-- Insert default email templates
insert into email_templates (type, subject, body, variables, is_active) values
  (
    'welcome',
    'Bem-vindo à Kernel Beauty SaaS, {{name}}!',
    'Olá {{name}},

Bem-vindo à Kernel Beauty SaaS! Sua conta foi criada com sucesso.

Detalhes da sua assinatura:
- Plano: {{plan}}
- Valor: {{price}}
- Status: {{status}}

Acesse agora: {{login_url}}

Equipe Kernel Beauty',
    ARRAY['name', 'plan', 'price', 'status', 'login_url'],
    true
  ),
  (
    'password_reset',
    'Recuperação de Senha - Kernel Beauty',
    'Olá {{name}},

Você solicitou a recuperação de senha. Clique no link abaixo para redefinir:

{{reset_url}}

Este link expira em 1 hora.

Se você não solicitou, ignore este email.',
    ARRAY['name', 'reset_url'],
    true
  ),
  (
    'subscription_confirmed',
    'Assinatura Confirmada - {{plan}}',
    'Parabéns {{name}}!

Sua assinatura do plano {{plan}} foi confirmada com sucesso.

Valor: {{price}}/mês
Próxima cobrança: {{next_billing_date}}

Obrigado por escolher a Kernel Beauty!',
    ARRAY['name', 'plan', 'price', 'next_billing_date'],
    true
  ),
  (
    'payment_failed',
    'Falha no Pagamento - Kernel Beauty',
    'Olá {{name}},

Houve uma falha ao processar seu pagamento do plano {{plan}}.

Motivo: {{failure_reason}}

Por favor, atualize seus dados de pagamento: {{update_payment_url}}',
    ARRAY['name', 'plan', 'failure_reason', 'update_payment_url'],
    true
  ),
  (
    'trial_ending',
    'Seu período de teste está acabando!',
    'Olá {{name}},

Seu período de teste do plano {{plan}} termina em {{trial_end_date}}.

Para continuar usando, escolha um plano: {{pricing_url}}',
    ARRAY['name', 'plan', 'trial_end_date', 'pricing_url'],
    true
  )
on conflict do nothing;

-- Create a function to update the updated_at timestamp automatically for settings and email_templates
-- Note: We reuse the same function as it's already defined

-- Create triggers to automatically update updated_at column for settings and email_templates
do $$
declare
  tables text[] := array['settings', 'email_templates'];
  table_name text;
begin
  foreach table_name in array tables loop
    execute format('
      drop trigger if exists update_%I_updated_at on %I;
      create trigger update_%I_updated_at
        before update on %I
        for each row
        execute function update_updated_at_column();
    ', table_name, table_name, table_name, table_name);
  end loop;
end $$;

-- Grant usage on schema to authenticated users
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;