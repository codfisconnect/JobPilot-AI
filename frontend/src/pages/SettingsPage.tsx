import React, { useState } from 'react';
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { useApp } from "../context/AppContext";
import {
  Settings as SettingsIcon,
  Key,
  Database,
  Cpu,
  Chrome,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const { showToast } = useApp();
  const [apiKey, setApiKey] = useState('');
  const [serverStatus, setServerStatus] = useState<any>(null);

  React.useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setServerStatus(data))
      .catch(err => setServerStatus({ status: 'offline', error: err.message }));
  }, []);

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2 className="settings-title">System Configuration & Integration</h2>
        <p className="settings-sub">
          Manage AI providers, review database state, and inspect Chrome extension connectivity.
        </p>
      </div>

      <div className="settings-grid">
        {/* AI Provider Config */}
        <Card className="settings-card">
          <div className="card-top-icon">
            <Key size={20} className="icon-indigo" />
            <h3 className="section-title">Gemini AI Engine</h3>
          </div>
          <p className="settings-desc">
            JobPilot AI utilizes Google Gemini 1.5 Flash (free tier) for dynamic semantic reasoning, resume summary synthesis, and ATS simulation.
          </p>

          <div className="status-indicator-box">
            <span className="indicator-label">Provider Status:</span>
            {serverStatus?.geminiConfigured ? (
              <Badge variant="emerald" size="sm">Gemini API Connected</Badge>
            ) : (
              <Badge variant="amber" size="sm">Heuristic & Demo Fallback Mode Active</Badge>
            )}
          </div>

          <div className="api-key-instructions">
            <span className="inst-title">How to activate Gemini Free Tier:</span>
            <ol className="inst-list">
              <li>Obtain a free key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">Google AI Studio <ExternalLink size={11} /></a>.</li>
              <li>Add your key inside the root <code>.env</code> file: <br /><code>GEMINI_API_KEY=your_key_here</code></li>
              <li>Restart the backend server. If no key is set, JobPilot runs with its full deterministic heuristic engine.</li>
            </ol>
          </div>
        </Card>

        {/* Database & Architecture */}
        <Card className="settings-card">
          <div className="card-top-icon">
            <Database size={20} className="icon-emerald" />
            <h3 className="section-title">Local SQLite Storage</h3>
          </div>
          <p className="settings-desc">
            Zero-infrastructure, self-contained embedded SQLite database engine using pure WebAssembly / sql.js.
          </p>

          <div className="db-stats-list">
            <div className="db-stat-item">
              <span>Database Engine</span>
              <code>SQLite 3 (sql.js WASM)</code>
            </div>
            <div className="db-stat-item">
              <span>Database Path</span>
              <code>database/jobpilot.sqlite</code>
            </div>
            <div className="db-stat-item">
              <span>Backend API</span>
              <code>Node.js + Express + TypeScript</code>
            </div>
            <div className="db-stat-item">
              <span>Frontend Client</span>
              <code>React 18 + Vite + TypeScript</code>
            </div>
          </div>
        </Card>

        {/* Chrome Extension Instructions */}
        <Card className="settings-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-top-icon">
            <Chrome size={20} className="icon-blue" />
            <h3 className="section-title">Chrome Extension (Manifest V3)</h3>
          </div>
          <p className="settings-desc">
            Analyze publicly accessible job opportunities straight from your browser.
          </p>

          <div className="extension-instructions">
            <div className="ext-step">
              <span className="step-num">1</span>
              <div>
                <strong>Build the Extension</strong>
                <p>Run <code>npm run extension</code> in the terminal to compile TypeScript to <code>extension/dist</code>.</p>
              </div>
            </div>

            <div className="ext-step">
              <span className="step-num">2</span>
              <div>
                <strong>Load in Google Chrome</strong>
                <p>Navigate to <code>chrome://extensions</code> in Chrome, toggle <strong>Developer mode</strong> ON at the top right, and click <strong>Load unpacked</strong>.</p>
              </div>
            </div>

            <div className="ext-step">
              <span className="step-num">3</span>
              <div>
                <strong>Select Extension Directory</strong>
                <p>Select the <code>extension/dist</code> folder in this project root.</p>
              </div>
            </div>

            <div className="ext-step">
              <span className="step-num">4</span>
              <div>
                <strong>Inspect Job Opportunity</strong>
                <p>Open any public job description page and click the <strong>JobPilot AI</strong> extension icon to extract and send the job details directly to your dashboard.</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Founder / Admin Applications Audit Console */}
        <Card className="settings-card" style={{ gridColumn: 'span 2', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
          <div className="card-top-icon">
            <Cpu size={20} className="icon-indigo" />
            <h3 className="section-title">Founder & Admin Console — Applications Audit</h3>
          </div>
          <p className="settings-desc">
            System-level audit verifying that Codewalla and Demo applications remain local simulated records with zero unauthorized external transmission.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase' }}>Codewalla Safeguard</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fbbf24', marginTop: '4px' }}>MANDATORY DEMO ONLY</div>
              <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>Zero external calls permitted to codewalla.com</p>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase' }}>External Mode Safeguard</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>APPLICATION_STARTED</div>
              <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>Requires candidate confirmation before marking applied</p>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase' }}>Resume Immutability</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#818cf8', marginTop: '4px' }}>VERSION SNAPSHOTS</div>
              <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>Exact submitted resume retained historically</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
