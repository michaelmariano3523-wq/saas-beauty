import { createClient, User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ejdsuslapvzsseqotvhp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqZHN1c2xhcHZ6c3NlcW90dmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNTE1NDksImV4cCI6MjA5MjgyNzU0OX0.3UoKRtP2znHuEVe9wBmc0Wtkuzr1m0dbQzB3lHROmQg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function onAuthStateChange(callback: (user: User | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data?.subscription?.unsubscribe();
}

export async function createUserDocument(_user: User) {
}
