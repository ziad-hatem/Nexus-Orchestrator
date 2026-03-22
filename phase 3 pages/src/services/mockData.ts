import { EventTrigger, TriggerAttempt, WebhookConfig } from '../types';

export const MOCK_TRIGGERS: EventTrigger[] = [
  {
    id: '1',
    key: 'ticket.created',
    category: 'Support',
    description: 'Fires when a new customer support request is initialized via the portal or API.',
    payloadSnippet: '{\n  "ticket_id": "T-1029",\n  "priority": "high"\n}',
    icon: 'Ticket',
    status: 'active',
  },
  {
    id: '2',
    key: 'payment.failed',
    category: 'Billing',
    description: 'Triggered immediately upon receipt of a decline code from the payment gateway.',
    payloadSnippet: '{\n  "reason": "insufficient",\n  "retries": 2\n}',
    icon: 'CreditCard',
    status: 'active',
  },
  {
    id: '3',
    key: 'user.onboarded',
    category: 'Growth',
    description: 'Broadcasted when a user completes the mandatory workspace setup flow.',
    payloadSnippet: '{\n  "user_id": "usr_99",\n  "plan": "pro"\n}',
    icon: 'UserPlus',
    status: 'active',
  },
  {
    id: '4',
    key: 'server.health_low',
    category: 'System',
    description: 'Fired when CPU or Memory utilization exceeds defined thresholds for >5 mins.',
    payloadSnippet: '{\n  "node": "cluster-01",\n  "cpu_usage": "94%"\n}',
    icon: 'Activity',
    status: 'active',
  },
];

export const MOCK_ATTEMPTS: TriggerAttempt[] = [
  {
    id: 'a1',
    status: 'Accepted',
    timestamp: '12:44:02 PM',
    size: '2.4KB',
    payload: '{\n  "event_type": "checkout.complete",\n  "data": {\n    "order_id": "ORD-99821",\n    "customer": {\n      "id": "user_01HG5",\n      "email": "test@nexus.io"\n    },\n    "amount": 29900\n  }\n}',
  },
  {
    id: 'a2',
    status: 'Rejected',
    timestamp: '12:43:58 PM',
    size: '1.1KB',
    response: {
      code: 401,
      message: 'Unauthorized',
      details: "Invalid Secret: The provided 'X-Nexus-Secret' does not match the active environment key.",
    },
    payload: '{\n  "event_type": "checkout.complete",\n  "data": {\n    "order_id": "ORD-99821",\n    "customer": {\n      "id": "user_01HG5",\n      "email": "test@nexus.io"\n    },\n    "amount": 29900\n  }\n}',
  },
];

export const MOCK_WEBHOOK: WebhookConfig = {
  id: 'wh1',
  name: 'Post-Purchase Webhook',
  description: 'Configure your inbound event endpoint. External services will send JSON payloads to this URL to trigger your workflow steps.',
  endpointUrl: 'https://api.nexus-orchestrator.io/v2/webhooks/whk_09x22_944f_kLp2_398a',
  secretToken: 'whsec_5f8a2b3c4d5e6f7g8h9i0j',
  method: 'POST Only',
  contentType: 'application/json',
  isEndpointSigningEnabled: true,
};
