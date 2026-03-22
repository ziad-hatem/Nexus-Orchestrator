import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { CatalogPage } from './pages/CatalogPage';
import { ConfigureTriggerPage } from './pages/ConfigureTriggerPage';
import { WebhookDetailsPage } from './pages/WebhookDetailsPage';
import { GeminiImagePage } from './pages/GeminiImagePage';
import { DashboardPage } from './pages/DashboardPage';
import { StreamsPage } from './pages/StreamsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DocsPage } from './pages/DocsPage';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50">
        <Sidebar />
        <div className="lg:pl-64 flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1 pt-16">
            <Routes>
              <Route path="/" element={<CatalogPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/configure" element={<ConfigureTriggerPage />} />
              <Route path="/trigger/:id" element={<WebhookDetailsPage />} />
              <Route path="/gemini-images" element={<GeminiImagePage />} />
              <Route path="/streams" element={<StreamsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/docs" element={<DocsPage />} />
              {/* Fallback */}
              <Route path="*" element={<CatalogPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}
