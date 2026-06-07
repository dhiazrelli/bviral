import { customFetch } from "@workspace/api-client-react";

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  data: T[];
  pagination: Pagination;
};

export type Platform = "facebook" | "instagram" | "tiktok" | "youtube" | "snapchat";
export type PostStatus = "scheduled" | "posted" | "failed" | "cancelled";
export type VideoStatus = "uploaded" | "processing" | "ready" | "failed";
export type QueueName = "post-publishing" | "video-processing" | "analytics-refresh" | "ai-processing";

export type AdminCreator = {
  id: string;
  email: string;
  fullName: string;
  connectedAccountsCount: number;
  unresolvedAlertsCount: number;
  lastActiveAt: string;
  createdAt: string;
  suspendedAt: string | null;
};

export type AdminCreatorListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: "createdAt" | "fullName" | "email" | "lastActiveAt";
  order?: "asc" | "desc";
  status?: "all" | "active" | "suspended";
};

export type AdminPostListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  creatorId?: string;
  platform?: Platform;
  status?: PostStatus;
  accountId?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
  sort?: "scheduledAt" | "createdAt";
  order?: "asc" | "desc";
};

export type AdminPost = {
  id: string;
  videoId: string;
  accountId: string;
  platform: Platform;
  status: PostStatus;
  scheduledAt: string;
  postedAt: string | null;
  externalPostId: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  creator: { id: string; email: string; fullName: string };
  account: { id: string; accountName: string; platform: Platform };
  video: { id: string; originalFilename: string | null };
};

export type AdminVideoListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  creatorId?: string;
  status?: VideoStatus;
  from?: string;
  to?: string;
  sort?: "createdAt" | "duration";
  order?: "asc" | "desc";
};

export type AdminVideo = {
  id: string;
  userId: string;
  originalUrl: string;
  originalFilename: string | null;
  processedUrl: string | null;
  duration: number | null;
  status: VideoStatus;
  createdAt: string;
  creator: { id: string; email: string; fullName: string };
  postsCount: number;
  totalViews: number;
};

export type AdminAuditEntry = {
  id: string;
  adminId: string;
  adminEmail: string | null;
  adminName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AdminAuditListParams = {
  page?: number;
  pageSize?: number;
  adminId?: string;
  action?: string;
  targetType?: "user" | "post" | "video" | "account" | "system";
  from?: string;
  to?: string;
};

export type QueueStats = {
  name: string;
  counts: Record<string, number>;
};

export type FailedJob = {
  id: string;
  name: string;
  failedReason: string | null;
  attemptsMade: number;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  data: unknown;
};

function buildSearch(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const adminApi = {
  listCreators(params: AdminCreatorListParams) {
    return customFetch<Paginated<AdminCreator>>(`/api/v1/admin/creators${buildSearch(params)}`);
  },
  inviteCreator(body: { email: string; fullName: string }) {
    return customFetch<AdminCreator>(`/api/v1/admin/creators`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  updateCreator(id: string, body: { fullName?: string; email?: string; role?: "admin" | "content_creator" }) {
    return customFetch<AdminCreator>(`/api/v1/admin/creators/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  suspendCreator(id: string) {
    return customFetch<{ id: string; suspended: true }>(`/api/v1/admin/creators/${id}/suspend`, {
      method: "POST",
    });
  },
  reactivateCreator(id: string) {
    return customFetch<{ id: string; suspended: false }>(`/api/v1/admin/creators/${id}/reactivate`, {
      method: "POST",
    });
  },
  deleteCreator(id: string) {
    return customFetch<void>(`/api/v1/admin/creators/${id}`, { method: "DELETE" });
  },

  listPosts(params: AdminPostListParams) {
    return customFetch<Paginated<AdminPost>>(`/api/v1/admin/posts${buildSearch(params)}`);
  },
  softDeletePost(id: string) {
    return customFetch<AdminPost>(`/api/v1/admin/posts/${id}`, { method: "DELETE" });
  },
  restorePost(id: string) {
    return customFetch<AdminPost>(`/api/v1/admin/posts/${id}/restore`, { method: "POST" });
  },
  bulkDeletePosts(ids: string[]) {
    return customFetch<{ deletedIds: string[]; count: number }>(`/api/v1/admin/posts/bulk-delete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  },

  listVideos(params: AdminVideoListParams) {
    return customFetch<Paginated<AdminVideo>>(`/api/v1/admin/videos${buildSearch(params)}`);
  },
  getVideo(id: string) {
    return customFetch<AdminVideo>(`/api/v1/admin/videos/${id}`);
  },
  deleteVideo(id: string) {
    return customFetch<void>(`/api/v1/admin/videos/${id}`, { method: "DELETE" });
  },

  analyticsOverview(params: {
    creatorId?: string;
    accountId?: string;
    postId?: string;
    videoId?: string;
    platform?: Platform;
    from?: string;
    to?: string;
  }) {
    return customFetch<import("@workspace/api-client-react").AnalyticsOverview>(
      `/api/v1/admin/analytics/overview${buildSearch(params)}`,
    );
  },
  analyticsCsvUrl(params: Record<string, unknown>) {
    return `/api/v1/admin/analytics/export.csv${buildSearch(params)}`;
  },

  listAuditLog(params: AdminAuditListParams) {
    return customFetch<Paginated<AdminAuditEntry>>(`/api/v1/admin/audit-log${buildSearch(params)}`);
  },

  systemHealth() {
    return customFetch<{ queues: QueueStats[]; collectedAt: string }>(`/api/v1/admin/system/health`);
  },
  systemFailedJobs(queue: QueueName, limit = 20) {
    return customFetch<{ queue: QueueName; jobs: FailedJob[] }>(
      `/api/v1/admin/system/failed-jobs${buildSearch({ queue, limit })}`,
    );
  },
  systemRetryJob(queue: QueueName, jobId: string) {
    return customFetch<{ queue: QueueName; jobId: string; retried: boolean }>(
      `/api/v1/admin/system/jobs/${queue}/${jobId}/retry`,
      { method: "POST" },
    );
  },
};
