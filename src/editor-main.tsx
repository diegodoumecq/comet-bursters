import React from 'react';
import ReactDOM from 'react-dom/client';

import { EditorApp } from './editor/EditorApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <EditorApp />
  </React.StrictMode>,
);
