import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { WorkflowDirectory } from './pages/WorkflowDirectory';
import { WorkflowDetail } from './pages/WorkflowDetail';
import { WorkflowHistory } from './pages/WorkflowHistory';
import { WorkflowCanvas } from './pages/WorkflowCanvas';
import { CreateWorkflow } from './pages/CreateWorkflow';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<WorkflowDirectory />} />
          <Route path="/workflows/new" element={<CreateWorkflow />} />
          <Route path="/workflows/:id" element={<WorkflowDetail />} />
          <Route path="/workflows/:id/history" element={<WorkflowHistory />} />
        </Route>
        
        {/* Full screen canvas routes */}
        <Route path="/workflows/:id/edit" element={<WorkflowCanvas />} />
        <Route path="/workflows/:id/versions/:versionId" element={<WorkflowCanvas />} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
