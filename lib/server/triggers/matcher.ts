import { normalizeWebhookPath } from "@/lib/server/validation";
import {
  getActiveManualBindingByWorkflowDbId,
  getActiveWebhookBindingByMatchKey,
  listActiveInternalEventBindings,
} from "@/lib/server/triggers/repository";

export const triggerMatcherDeps = {
  normalizeWebhookPath,
  getActiveManualBindingByWorkflowDbId,
  getActiveWebhookBindingByMatchKey,
  listActiveInternalEventBindings,
};

export async function matchManualTriggerBinding(workflowDbId: string) {
  return triggerMatcherDeps.getActiveManualBindingByWorkflowDbId(workflowDbId);
}

export async function matchWebhookTriggerBinding(pathname: string) {
  return triggerMatcherDeps.getActiveWebhookBindingByMatchKey(
    triggerMatcherDeps.normalizeWebhookPath(pathname),
  );
}

export async function matchInternalEventBindings(eventKey: string) {
  return triggerMatcherDeps.listActiveInternalEventBindings(eventKey);
}
