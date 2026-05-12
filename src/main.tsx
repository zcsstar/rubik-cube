import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from '@ui/i18n/I18nProvider';
import './index.css';

// BASE_URL is "/rubik-cube/" on GitHub Pages and "./" everywhere else (dev
// server, Capacitor native shell). BrowserRouter needs an absolute path —
// fall back to "/" when the base is a relative path.
const base = import.meta.env.BASE_URL;
const basename = base.startsWith('/') ? base : '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
);
