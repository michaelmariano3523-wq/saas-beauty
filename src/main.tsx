import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { auth, db } from './firebase';

// Expose Firebase to window for console access
if (typeof window !== 'undefined') {
  (window as any).firebase = {
    auth: () => auth,
    firestore: () => db
  };
}

createRoot(document.getElementById('root')!).render(
  <App />,
);
