import React from 'react';
import ReactDOM from 'react-dom/client';
import './CSS/index.css';
import App from './Components/App';
import 'bootstrap/dist/css/bootstrap.css';
import "./CSS/Style.css";

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
