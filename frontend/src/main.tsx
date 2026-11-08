import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import './platform/app-layout.css';

document.documentElement.classList.add('spoty-ui');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
