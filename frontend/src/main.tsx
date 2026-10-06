import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";
import App from "./App";
import './styles/global.css';

import { AuthProvider } from "./context/AuthContext";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
