import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.tsx';

import { GOOGLE_CLIENT_ID } from './config/auth';
import { installGlobalErrorReporting } from './utils/errorReporter';
import { redirectWwwToApex, upgradeLegacyHashUrl } from './utils/siteUrl';

// Old #/page links (printed QR posters, bookmarks) -> /page
upgradeLegacyHashUrl();

// www.mediarca.in -> mediarca.in, so sign-in isn't split across two addresses
redirectWwwToApex();

// Send uncaught browser errors to the backend log
installGlobalErrorReporting();

// Seamlessly recover when Vite dynamic chunk imports fail due to a fresh deployment
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    const lastReload = window.sessionStorage.getItem('mediarca_preload_reload');
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
      window.sessionStorage.setItem('mediarca_preload_reload', String(now));
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
);
