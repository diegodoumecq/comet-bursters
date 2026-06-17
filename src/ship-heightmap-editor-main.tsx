import React from 'react';
import ReactDOM from 'react-dom/client';

import { ShipHeightmapEditorApp } from './ship-heightmap-editor/ShipHeightmapEditorApp';

import './index.css';

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <ShipHeightmapEditorApp />
  </React.StrictMode>,
);
