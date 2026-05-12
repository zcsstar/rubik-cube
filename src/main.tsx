import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from '@ui/i18n/I18nProvider';
import { initAds, maybeShowColdStartAd } from './ads/admob';
import './index.css';

// Fire-and-forget ad bootstrap. No-op on web; on native it initialises
// AdMob, requests ATT/consent, pre-loads an interstitial, and shows the
// cold-start interstitial after a short delay.
void initAds().then(() => maybeShowColdStartAd());

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
