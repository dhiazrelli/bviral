import { z } from "zod";
import type {
  AlertResponseDto,
  AlertsRepository,
} from "../repositories/alerts.repository";

export const alertParamsSchema = z.object({
  id: z.string().uuid(),
});

export class AlertNotFoundError extends Error {
  constructor() {
    super("Alert was not found.");
  }
}

export interface AlertsService {
  listAlerts(userId: string): Promise<AlertResponseDto[]>;
  dismissAlert(alertId: string, userId: string): Promise<void>;
}

export function buildAlertsService(alertsRepository: AlertsRepository): AlertsService {
  return {
    listAlerts(userId) {
      return alertsRepository.listForUser(userId);
    },

    async dismissAlert(alertId, userId) {
      const resolved = await alertsRepository.resolveForUser(alertId, userId);

      if (!resolved) {
        throw new AlertNotFoundError();
      }
    },
  };
}
