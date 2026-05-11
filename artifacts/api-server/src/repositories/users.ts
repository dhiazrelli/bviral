import { count, desc, eq, ilike, or } from "drizzle-orm";
import { usersTable, type Database, type NewUserRecord, type UserRecord } from "@workspace/db";

export interface UserResponseDto {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "content_creator";
  createdAt: string;
  updatedAt: string;
}

export interface ListUsersQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface CreateUserPayload {
  email: string;
  fullName: string;
  role: "admin" | "content_creator";
}

export interface EnsureDevelopmentUserPayload extends CreateUserPayload {
  id: string;
}

export interface UsersRepository {
  list(input: ListUsersQuery): Promise<{
    data: UserResponseDto[];
    meta: {
      page: number;
      limit: number;
      total: number;
    };
  }>;
  findById(userId: string): Promise<UserResponseDto | null>;
  create(input: CreateUserPayload): Promise<UserResponseDto>;
  ensureDevelopmentUser(input: EnsureDevelopmentUserPayload): Promise<UserResponseDto>;
}

function serializeUser(user: UserRecord): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function buildSearchFilter(search: string | undefined) {
  if (!search) {
    return undefined;
  }

  const term = `%${search}%`;
  return or(ilike(usersTable.email, term), ilike(usersTable.fullName, term));
}

export function buildUsersRepository(db: Database): UsersRepository {
  return {
    async list(input) {
      const offset = (input.page - 1) * input.limit;
      const searchFilter = buildSearchFilter(input.search);

      const users = searchFilter
        ? await db
          .select()
          .from(usersTable)
          .where(searchFilter)
          .orderBy(desc(usersTable.createdAt))
          .limit(input.limit)
          .offset(offset)
        : await db
          .select()
          .from(usersTable)
          .orderBy(desc(usersTable.createdAt))
          .limit(input.limit)
          .offset(offset);

      const totalResult = searchFilter
        ? await db
          .select({ total: count() })
          .from(usersTable)
          .where(searchFilter)
        : await db.select({ total: count() }).from(usersTable);

      return {
        data: users.map(serializeUser),
        meta: {
          page: input.page,
          limit: input.limit,
          total: Number(totalResult[0]?.total ?? 0),
        },
      };
    },

    async findById(userId) {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      return user ? serializeUser(user) : null;
    },

    async create(input) {
      const payload: NewUserRecord = {
        email: input.email,
        fullName: input.fullName,
        role: input.role,
      };

      const [user] = await db.insert(usersTable).values(payload).returning();
      return serializeUser(user);
    },

    async ensureDevelopmentUser(input) {
      const payload: NewUserRecord = {
        id: input.id,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
      };

      const [inserted] = await db
        .insert(usersTable)
        .values(payload)
        .onConflictDoNothing({ target: usersTable.id })
        .returning();

      if (inserted) {
        return serializeUser(inserted);
      }

      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, input.id))
        .limit(1);

      if (!user) {
        throw new Error("Development user could not be loaded.");
      }

      return serializeUser(user);
    },
  };
}
