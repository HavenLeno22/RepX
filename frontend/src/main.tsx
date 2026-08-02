import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { bootstrapPrefs } from './store/prefs';
import './styles/global.css';

// Applied before React mounts so the first paint already honours the player's
// motion and contrast preferences. Getting this after mount would mean an
// animation running once for someone who asked for none.
bootstrapPrefs();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
