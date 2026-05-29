import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { supabase } from './services/supabaseClient';

// Expose Supabase to window for console access
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}

createRoot(document.getElementById('root')!).render(
  <App />,
);
