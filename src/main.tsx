import React from 'react';
import ReactDOM from 'react-dom/client';

import { LandingApp } from './LandingApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <LandingApp />
  </React.StrictMode>,
);
