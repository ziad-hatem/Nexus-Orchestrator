import { GoogleGenAI } from "@google/genai";

export interface Execution {
  id: string;
  name: string;
  category: string;
  status: 'success' | 'running' | 'failed' | 'pending';
  triggerSource: string;
  startedAt: string;
  duration: string;
  correlationId: string;
  version: string;
  cluster: string;
}

export interface ExecutionStep {
  id: string;
  name: string;
  module: string;
  status: 'success' | 'running' | 'pending' | 'failed';
  duration?: string;
  logs: { timestamp: string; message: string; type?: 'info' | 'success' | 'error' }[];
  codeSnippet?: string;
}

export interface GeminiImageResponse {
  imageUrl: string;
  prompt: string;
}
