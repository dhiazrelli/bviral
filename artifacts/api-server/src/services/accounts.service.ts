import { z } from "zod";
import type {
  AccountResponseDto,
  AccountsRepository,
  CreateAccountPayload,
} from "../repositories/accounts.repository";

export const accountPlatformSchema = z.enum([
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "snapchat",
]);

export const accountParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createAccountBodySchema = z.object({
  platform: accountPlatformSchema,
  accountName: z.string().trim().min(1).max(255),
  accessToken: z.string().trim().min(1),
  refreshToken: z.string().trim().min(1).nullable().optional(),
  tokenExpiry: z.string().datetime({ offset: true }).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateAccountBodySchema = z
  .object({
    accountName: z.string().trim().min(1).max(255).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (value) => value.accountName !== undefined || value.metadata !== undefined,
    { message: "Provide at least one field to update." },
  );

export type AccountParams = z.infer<typeof accountParamsSchema>;
export type CreateAccountBody = z.infer<typeof createAccountBodySchema>;
export type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>;

export class AccountNotFoundError extends Error {
  readonly name = "AccountNotFoundError";

  constructor() {
    super("Account was not found.");
  }
}

export interface AccountsService {
  listAccounts(userId: string): Promise<AccountResponseDto[]>;
  getAccount(accountId: string, userId: string): Promise<AccountResponseDto>;
  connectAccount(input: CreateAccountBody, userId: string): Promise<AccountResponseDto>;
  updateAccount(
    accountId: string,
    userId: string,
    input: UpdateAccountBody,
  ): Promise<AccountResponseDto>;
  disconnectAccount(accountId: string, userId: string): Promise<void>;
}

function parseTokenExpiry(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

export function buildAccountsService(
  accountsRepository: AccountsRepository,
): AccountsService {
  return {
    listAccounts(userId) {
      return accountsRepository.listForUser(userId);
    },

    async getAccount(accountId, userId) {
      const account = await accountsRepository.findForUser(accountId, userId);

      if (!account) {
        throw new AccountNotFoundError();
      }

      return account;
    },

    connectAccount(input, userId) {
      const payload: CreateAccountPayload = {
        platform: input.platform,
        accountName: input.accountName,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? null,
        tokenExpiry: parseTokenExpiry(input.tokenExpiry),
        userId,
        metadata: input.metadata ?? {},
      };

      return accountsRepository.create(payload);
    },

    async updateAccount(accountId, userId, input) {
      const updated = await accountsRepository.updateForUser(accountId, userId, {
        accountName: input.accountName,
        metadata: input.metadata,
      });

      if (!updated) {
        throw new AccountNotFoundError();
      }

      return updated;
    },

    async disconnectAccount(accountId, userId) {
      const deleted = await accountsRepository.deleteForUser(accountId, userId);

      if (!deleted) {
        throw new AccountNotFoundError();
      }
    },
  };
}
