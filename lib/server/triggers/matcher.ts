import "server-only";

import { normalizeWebhookPath } from "@/lib/server/validation";
import {
  getActiveManualBindingByWorkflowDbId,
  getActiveWebhookBindingByMatchKey,
  listActiveInternalEventBindings,
} from "@/lib/server/triggers/repository";

export async function matchManualTriggerBinding(workflowDbId: string) {
  return getActiveManualBindingByWorkflowDbId(workflowDbId);
}

export async function matchWebhookTriggerBinding(pathname: string) {
  return getActiveWebhookBindingByMatchKey(normalizeWebhookPath(pathname));
}

export async function matchInternalEventBindings(eventKey: string) {
  return listActiveInternalEventBindings(eventKey);
}
