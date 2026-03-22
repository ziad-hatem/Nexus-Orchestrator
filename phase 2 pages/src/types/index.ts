export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'admin' | 'user';
}

export type WorkflowStatus = 'active' | 'draft' | 'archived' | 'legacy';

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  latestVersion: string;
  lastModified: string;
  modifiedBy: string;
  category: string;
  tags: string[];
  trigger: string;
  resources: string;
  owner: string;
  ownerAvatar: string;
}

export interface WorkflowVersion {
  id: string;
  versionId: string;
  status: 'active' | 'legacy' | 'draft';
  publisher: string;
  publisherAvatar: string;
  timestamp: string;
  notes: string;
}

export interface Execution {
  id: string;
  workflowId: string;
  status: 'completed' | 'failed' | 'running';
  timestamp: string;
  duration: string;
  recordsProcessed: number;
  message?: string;
}

export interface Node {
  id: string;
  type: 'trigger' | 'process' | 'condition' | 'action' | 'archive';
  label: string;
  description: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface Edge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowCanvas {
  nodes: Node[];
  edges: Edge[];
}
