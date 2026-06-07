import { and, desc, eq } from "drizzle-orm";
import {
  accountsTable,
  type AccountRecord,
  type Database,
  type NewAccountRecord,
} from "@workspace/db";
import {
  decryptOptionalToken,
  decryptToken,
  encryptOptionalToken,
  encryptToken,
} from "../lib/token-encryption";

export type AccountPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "snapchat";

export interface AccountResponseDto {
  id: string;
  platform: AccountPlatform;
  accountName: string;
  tokenExpiry: string | null;
  userId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AccountSecretRecord extends AccountResponseDto {
  accessToken: string;
  refreshToken: string | null;
}

export interface CreateAccountPayload {
  platform: AccountPlatform;
  accountName: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiry?: Date | null;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface AccountMetadataDto {
  id: string;
  platform: AccountPlatform;
  accountName: string;
  tokenExpiry: string | null;
  userId: string;
  createdAt: string;
}

export interface UpdateAccountPayload {
  accountName?: string;
  metadata?: Record<string, unknown>;
}

export interface AccountsRepository {
  listForUser(userId: string): Promise<AccountResponseDto[]>;
  listForCreator(creatorId: string): Promise<AccountMetadataDto[]>;
  findForUser(accountId: string, userId: string): Promise<AccountResponseDto | null>;
  findSecretForUser(accountId: string, userId: string): Promise<AccountSecretRecord | null>;
  create(input: CreateAccountPayload): Promise<AccountResponseDto>;
  upsertConnectedAccount(input: CreateAccountPayload): Promise<AccountResponseDto>;
  updateForUser(
    accountId: string,
    userId: string,
    input: UpdateAccountPayload,
  ): Promise<AccountResponseDto | null>;
  updateTokens(
    accountId: string,
    input: {
      accessToken: string;
      refreshToken?: string | null;
      tokenExpiry?: Date | null;
    },
  ): Promise<void>;
  deleteForUser(accountId: string, userId: string): Promise<boolean>;
  deleteById(accountId: string): Promise<boolean>;
}

function serializeAccount(account: AccountRecord): AccountResponseDto {
  return {
    id: account.id,
    platform: account.platform,
    accountName: account.accountName,
    tokenExpiry: account.tokenExpiry?.toISOString() ?? null,
    userId: account.userId,
    metadata: account.metadata,
    createdAt: account.createdAt.toISOString(),
  };
}

function serializeSecretAccount(account: AccountRecord): AccountSecretRecord {
  return {
    ...serializeAccount(account),
    // Tokens are stored encrypted at rest (AES-256-GCM). Decrypt only here,
    // when a service explicitly needs the raw value to call the platform API.
    accessToken: decryptToken(account.accessToken),
    refreshToken: decryptOptionalToken(account.refreshToken ?? null),
  };
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPlatformIdentity(account: {
  platform: AccountPlatform;
  accountName: string;
  metadata?: Record<string, unknown>;
}) {
  const metadata = account.metadata ?? {};

  switch (account.platform) {
    case "facebook":
      return getMetadataString(metadata, "pageId") ?? account.accountName;
    case "instagram":
      return getMetadataString(metadata, "instagramBusinessAccountId") ?? account.accountName;
    case "tiktok":
      return getMetadataString(metadata, "openId") ?? getMetadataString(metadata, "unionId") ?? account.accountName;
    case "youtube":
      return getMetadataString(metadata, "channelId") ?? account.accountName;
    case "snapchat":
      return getMetadataString(metadata, "snapchatAccountId") ?? getMetadataString(metadata, "username") ?? account.accountName;
  }
}

function serializeAccountMetadata(account: AccountRecord): AccountMetadataDto {
  return {
    id: account.id,
    platform: account.platform,
    accountName: account.accountName,
    tokenExpiry: account.tokenExpiry?.toISOString() ?? null,
    userId: account.userId,
    createdAt: account.createdAt.toISOString(),
  };
}

export function buildAccountsRepository(db: Database): AccountsRepository {
  async function findForUser(accountId: string, userId: string) {
    const [account] = await db
      .select()
      .from(accountsTable)
      .where(and(
        eq(accountsTable.id, accountId),
        eq(accountsTable.userId, userId),
      ))
      .limit(1);

    return account ? serializeAccount(account) : null;
  }

  return {
    async listForUser(userId) {
      const accounts = await db
        .select()
        .from(accountsTable)
        .where(eq(accountsTable.userId, userId))
        .orderBy(desc(accountsTable.createdAt));

      return accounts.map(serializeAccount);
    },

    async listForCreator(creatorId) {
      const accounts = await db
        .select()
        .from(accountsTable)
        .where(eq(accountsTable.userId, creatorId))
        .orderBy(desc(accountsTable.createdAt));

      return accounts.map(serializeAccountMetadata);
    },

    findForUser,

    async findSecretForUser(accountId, userId) {
      const [account] = await db
        .select()
        .from(accountsTable)
        .where(and(
          eq(accountsTable.id, accountId),
          eq(accountsTable.userId, userId),
        ))
        .limit(1);

      return account ? serializeSecretAccount(account) : null;
    },

    async create(input) {
      const payload: NewAccountRecord = {
        platform: input.platform,
        accountName: input.accountName,
        accessToken: encryptToken(input.accessToken),
        refreshToken: encryptOptionalToken(input.refreshToken ?? null),
        tokenExpiry: input.tokenExpiry ?? null,
        userId: input.userId,
        metadata: input.metadata ?? {},
      };

      const [account] = await db.insert(accountsTable).values(payload).returning();
      return serializeAccount(account);
    },

    async upsertConnectedAccount(input) {
      const payload: NewAccountRecord = {
        platform: input.platform,
        accountName: input.accountName,
        accessToken: encryptToken(input.accessToken),
        refreshToken: encryptOptionalToken(input.refreshToken ?? null),
        tokenExpiry: input.tokenExpiry ?? null,
        userId: input.userId,
        metadata: input.metadata ?? {},
      };

      const existingAccounts = await db
        .select()
        .from(accountsTable)
        .where(and(
          eq(accountsTable.userId, input.userId),
          eq(accountsTable.platform, input.platform),
        ))
        .orderBy(desc(accountsTable.createdAt));
      const inputIdentity = getPlatformIdentity(input);
      const existing = existingAccounts.find((account) => (
        getPlatformIdentity(account) === inputIdentity
      ));

      if (existing) {
        const [account] = await db
          .update(accountsTable)
          .set(payload)
          .where(eq(accountsTable.id, existing.id))
          .returning();

        return serializeAccount(account);
      }

      const [account] = await db.insert(accountsTable).values(payload).returning();
      return serializeAccount(account);
    },

    async updateForUser(accountId, userId, input) {
      const updates: Partial<NewAccountRecord> = {};

      if (typeof input.accountName === "string" && input.accountName.trim()) {
        updates.accountName = input.accountName.trim();
      }

      if (input.metadata !== undefined) {
        updates.metadata = input.metadata;
      }

      if (Object.keys(updates).length === 0) {
        return findForUser(accountId, userId);
      }

      const [account] = await db
        .update(accountsTable)
        .set(updates)
        .where(and(
          eq(accountsTable.id, accountId),
          eq(accountsTable.userId, userId),
        ))
        .returning();

      return account ? serializeAccount(account) : null;
    },

    async updateTokens(accountId, input) {
      await db
        .update(accountsTable)
        .set({
          accessToken: encryptToken(input.accessToken),
          refreshToken: input.refreshToken === undefined
            ? undefined
            : encryptOptionalToken(input.refreshToken),
          tokenExpiry: input.tokenExpiry ?? null,
        })
        .where(eq(accountsTable.id, accountId));
    },

    async deleteForUser(accountId, userId) {
      const deleted = await db
        .delete(accountsTable)
        .where(and(
          eq(accountsTable.id, accountId),
          eq(accountsTable.userId, userId),
        ))
        .returning({ id: accountsTable.id });

      return deleted.length > 0;
    },

    async deleteById(accountId) {
      const deleted = await db
        .delete(accountsTable)
        .where(eq(accountsTable.id, accountId))
        .returning({ id: accountsTable.id });

      return deleted.length > 0;
    },
  };
}
