export type EventCategory = 'Support' | 'Infrastructure' | 'Billing' | 'Growth' | 'System';

export interface EventTrigger {
  id: string;
  key: string;
  category: EventCategory;
  description: string;
  payloadSnippet: string;
  icon: string;
  status: 'active' | 'draft' | 'inactive';
}

export interface TriggerAttempt {
  id: string;
  status: 'Accepted' | 'Rejected';
  timestamp: string;
  size: string;
  response?: {
    code: number;
    message: string;
    details: string;
  };
  payload: string;
}

export interface WebhookConfig {
  id: string;
  name: string;
  description: string;
  endpointUrl: string;
  secretToken: string;
  method: string;
  contentType: string;
  isEndpointSigningEnabled: boolean;
}
