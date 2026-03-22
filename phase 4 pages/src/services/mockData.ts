import { Execution, ExecutionStep } from '../types';

export const MOCK_EXECUTIONS: Execution[] = [
  {
    id: 'nexus-83a2-91bf',
    name: 'Daily Revenue Aggregator',
    category: 'Finance / Reporting',
    status: 'success',
    triggerSource: 'Scheduled',
    startedAt: 'Oct 24, 2023 · 08:00:01',
    duration: '12s',
    correlationId: 'c-832-ax-11234',
    version: 'v2.4.1 (Stable)',
    cluster: 'US-East-1 Orchestration Cluster'
  },
  {
    id: 'nexus-42f1-00cc',
    name: 'Real-time User Onboarding',
    category: 'Identity / Auth',
    status: 'running',
    triggerSource: 'Webhook',
    startedAt: 'Oct 24, 2023 · 09:14:22',
    duration: '--',
    correlationId: 'c-421-bx-22345',
    version: 'v2.5.0 (Beta)',
    cluster: 'EU-West-1 Orchestration Cluster'
  },
  {
    id: 'nexus-11e4-55aa',
    name: 'AWS Inventory Sync',
    category: 'Infrastructure / Cloud',
    status: 'failed',
    triggerSource: 'Manual',
    startedAt: 'Oct 24, 2023 · 09:10:00',
    duration: '4m 12s',
    correlationId: 'c-114-cx-33456',
    version: 'v2.4.1 (Stable)',
    cluster: 'US-West-2 Orchestration Cluster'
  },
  {
    id: 'nexus-99z0-bb12',
    name: 'Temp Logs Cleanup',
    category: 'Operations / Maintenance',
    status: 'pending',
    triggerSource: 'Scheduled',
    startedAt: 'Oct 24, 2023 · 09:30:00',
    duration: '--',
    correlationId: 'c-990-dx-44567',
    version: 'v2.3.9 (Stable)',
    cluster: 'US-East-1 Orchestration Cluster'
  },
  {
    id: 'RUN-88921',
    name: 'Data Ingestion Pipeline',
    category: 'Data Engineering',
    status: 'running',
    triggerSource: 'Scheduled Webhook (Daily Sync)',
    startedAt: 'Oct 24, 2023 · 14:22:18 UTC',
    duration: '14s',
    correlationId: 'c-992-bx-77182',
    version: 'v2.4.1 (Stable)',
    cluster: 'US-East-1 Orchestration Cluster'
  }
];

export const MOCK_STEPS: Record<string, ExecutionStep[]> = {
  'RUN-88921': [
    {
      id: 'step-1',
      name: 'Authenticate API',
      module: 'OAuth2.0 Client',
      status: 'success',
      duration: '244ms',
      logs: [
        { timestamp: '14:22:18', message: 'Generating token for nexus-auth-prod...', type: 'info' },
        { timestamp: '14:22:18', message: 'Token validated. Scopes: read:data, write:logs.', type: 'success' }
      ]
    },
    {
      id: 'step-2',
      name: 'Fetch Data',
      module: 'HTTP GET Request',
      status: 'success',
      duration: '1.2s',
      logs: [
        { timestamp: '14:22:19', message: 'Querying endpoint /v3/sync/batch_82...', type: 'info' },
        { timestamp: '14:22:19', message: 'Received 402 records (JSON). Compression: Brotli.', type: 'success' }
      ]
    },
    {
      id: 'step-3',
      name: 'Transform Payload',
      module: 'JQ Processor',
      status: 'running',
      logs: [],
      codeSnippet: `001 Map input: payload.records -> target.inventory\n002 Applying filter: status == "active"\n003 _`
    },
    {
      id: 'step-4',
      name: 'Push to Warehouse',
      module: 'Snowflake Connector',
      status: 'pending',
      logs: []
    }
  ]
};
