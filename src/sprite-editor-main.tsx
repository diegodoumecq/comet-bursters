import React from 'react';
import ReactDOM from 'react-dom/client';

import { SpriteEditorApp } from './sprite-editor/SpriteEditorApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <SpriteEditorApp />
  </React.StrictMode>,
);
