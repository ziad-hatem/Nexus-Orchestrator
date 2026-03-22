import { Workflow, WorkflowVersion, Execution } from '../types';
import { mockWorkflows, mockVersions, mockExecutions } from '../constants/mockData';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const workflowService = {
  async getWorkflows(): Promise<Workflow[]> {
    await delay(500);
    return mockWorkflows;
  },

  async getWorkflowById(id: string): Promise<Workflow | undefined> {
    await delay(300);
    return mockWorkflows.find(w => w.id === id);
  },

  async getVersions(workflowId: string): Promise<WorkflowVersion[]> {
    await delay(400);
    return mockVersions[workflowId] || [];
  },

  async getExecutions(workflowId: string): Promise<Execution[]> {
    await delay(400);
    return mockExecutions[workflowId] || [];
  },
};
