import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/common/Layout';
import { ExecutionsPage } from './pages/ExecutionsPage';
import { RunDetailPage } from './pages/RunDetailPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/executions" replace />} />
          <Route path="/executions" element={<ExecutionsPage />} />
          <Route path="/executions/:id" element={<RunDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Placeholder routes for navigation */}
          <Route path="/dashboard" element={<Navigate to="/executions" replace />} />
          <Route path="/workflows" element={<div className="py-20 text-center text-secondary">Workflows Module Coming Soon</div>} />
          <Route path="/overview" element={<Navigate to="/executions" replace />} />
          <Route path="/errors" element={<div className="py-20 text-center text-secondary">Error Logs Module Coming Soon</div>} />
          <Route path="/health" element={<div className="py-20 text-center text-secondary">Node Health Module Coming Soon</div>} />
          <Route path="/admin" element={<div className="py-20 text-center text-secondary">Admin Console Module Coming Soon</div>} />
          <Route path="/support" element={<div className="py-20 text-center text-secondary">Support Center Coming Soon</div>} />
          <Route path="/docs" element={<div className="py-20 text-center text-secondary">Documentation Coming Soon</div>} />
        </Routes>
      </Layout>
    </Router>
  );
}
