import React from 'react';
import ReactDOM from 'react-dom/client';

import { SpritesheetEditorApp } from './spritesheet-editor/SpritesheetEditorApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <SpritesheetEditorApp />
  </React.StrictMode>,
);
