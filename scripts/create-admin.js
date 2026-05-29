require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

(async () => {
  const email = 'michaelmarianodasilva81@gmail.com';
  const password = 'M@1dasilva';

  const { data: user, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // You can store admin flag in user_metadata or app_metadata
    user_metadata: { role: 'admin' },
  });

  if (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }

  console.log('Admin user created:', user);
})();
