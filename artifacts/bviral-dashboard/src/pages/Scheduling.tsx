import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  Layers,
  ListFilter,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import {
  SiFacebook,
  SiInstagram,
  SiSnapchat,
  SiTiktok,
  SiYoutube,
} from "react-icons/si";
import type { IconType } from "react-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  type Account,
  type AccountPlatform,
  type Post,
  type Video,
  getListPostsQueryKey,
  getListVideosQueryKey,
  useCreatePost,
  useDeletePost,
  useListAccounts,
  useListPosts,
  useListVideos,
  useUploadVideo,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const platformLabels: Record<AccountPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

const platformColors: Record<AccountPlatform, string> = {
  instagram: "bg-pink-500/10 text-pink-400 border-pink-500/15",
  tiktok: "bg-cyan-500/10 text-cyan-400 border-cyan-500/15",
  youtube: "bg-red-500/10 text-red-400 border-red-500/15",
  snapchat: "bg-yellow-500/10 text-yellow-400 border-yellow-500/15",
  facebook: "bg-blue-500/10 text-blue-400 border-blue-500/15",
};

const platformIcons: Record<AccountPlatform, IconType> = {
  instagram: SiInstagram,
  tiktok: SiTiktok,
  youtube: SiYoutube,
  snapchat: SiSnapchat,
  facebook: SiFacebook,
};

function PlatformBadge({
  platform,
  className,
  iconClassName,
}: {
  platform: AccountPlatform;
  className?: string;
  iconClassName?: string;
}) {
  const Icon = platformIcons[platform];
  return (
    <span
      title={platformLabels[platform]}
      aria-label={platformLabels[platform]}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-md border",
        platformColors[platform],
        className,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", iconClassName)} aria-hidden="true" />
    </span>
  );
}

const statusConfig = {
  Active: { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/15", dot: "bg-emerald-400" },
  Idle: { color: "text-muted-foreground bg-white/[0.04] border-white/[0.08]", dot: "bg-white/40" },
  Attention: { color: "text-amber-400 bg-amber-400/10 border-amber-400/15", dot: "bg-amber-400" },
};

type PipelineFilter = "All" | "Active" | "Attention";

interface ComposerForm {
  accountId: string;
  videoId: string;
  scheduledAt: string;
  title: string;
  caption: string;
  uploadFile: File | null;
}

interface AccountLane {
  account: Account;
  scheduled: Post[];
  posted: Post[];
  failed: Post[];
  status: keyof typeof statusConfig;
  lastPostAt: string | null;
}

function getAccountStatus(account: Account, scheduled: Post[], failed: Post[]): AccountLane["status"] {
  const tokenExpired = account.tokenExpiry ? new Date(account.tokenExpiry).getTime() <= Date.now() : false;

  if (tokenExpired || failed.length > 0) {
    return "Attention";
  }

  return scheduled.length > 0 ? "Active" : "Idle";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function timeAgo(value: string | null) {
  if (!value) {
    return "No posts yet";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function getStringMetadata(post: Post | null, key: string) {
  const value = post?.metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function extractDuplicateConflict(error: unknown): DuplicateUpload | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { status?: number; data?: unknown };
  if (candidate.status !== 409) return null;
  const data = candidate.data;
  if (!data || typeof data !== "object") return null;
  const existing = (data as { existing?: Video }).existing;
  if (!existing || typeof existing.id !== "string") return null;
  return {
    filename: existing.originalFilename ?? "this file",
    existing,
  };
}

function toDateTimeLocalValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function getDefaultScheduledAt() {
  const date = new Date(Date.now() + 30 * 60_000);
  date.setSeconds(0, 0);
  return toDateTimeLocalValue(date);
}

function createInitialComposerForm(accounts: Account[], videos: Video[]): ComposerForm {
  return {
    accountId: accounts[0]?.id ?? "",
    videoId: videos[0]?.id ?? "",
    scheduledAt: getDefaultScheduledAt(),
    title: "",
    caption: "",
    uploadFile: null,
  };
}

function getVideoLabel(video: Video) {
  if (video.originalFilename) {
    return video.originalFilename;
  }

  const url = video.processedUrl ?? video.originalUrl;

  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").filter(Boolean).at(-1);
    return filename ? decodeURIComponent(filename) : video.id.slice(0, 8);
  } catch {
    return video.id.slice(0, 8);
  }
}

interface DuplicateUpload {
  filename: string;
  existing: Video;
}

interface BulkRow {
  row: number;
  accountName: string;
  scheduledAt: string;
  videoFilename: string;
  title: string;
  caption: string;
  status: "valid" | "invalid";
  reason?: string;
  resolved?: {
    account: Account;
    video: Video;
    scheduledAt: Date;
  };
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      current.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      current.push(cell);
      cell = "";
      rows.push(current);
      current = [];
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }

  return rows.filter((row) => row.some((value) => value.trim().length > 0));
}

const BULK_CSV_TEMPLATE_HEADER = "account_name,scheduled_at,video_filename,title,caption\n";
const BULK_CSV_TEMPLATE_EXAMPLE = "marcus.everett,2026-06-12T18:00:00Z,clip-01.mp4,Sunset cruise,\"Late-night drive vibes\"\n";

function MiniCalendar({ scheduledPosts }: { scheduledPosts: Post[] }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const scheduledDays = useMemo(() => new Set(
    scheduledPosts
      .filter((post) => {
        const date = new Date(post.scheduledAt);
        return date.getFullYear() === viewDate.getFullYear() && date.getMonth() === viewDate.getMonth();
      })
      .map((post) => new Date(post.scheduledAt).getDate()),
  ), [scheduledPosts, viewDate]);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];

  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-white flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/10">
            <CalendarIcon className="w-3.5 h-3.5 text-primary" />
          </div>
          {MONTH_NAMES[month]} {year}
        </h2>
        <div className="flex gap-1">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground/50 hover:text-white transition-colors cursor-pointer">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground/50 hover:text-white transition-colors cursor-pointer">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="text-center text-[10px] text-muted-foreground/40 pb-1.5 font-semibold">{day}</div>
        ))}
        {cells.map((day, index) => {
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const hasPost = day !== null && scheduledDays.has(day);

          return (
            <div
              key={index}
              className={`relative aspect-square flex items-center justify-center text-[11px] rounded-lg transition-all duration-200 ${
                day === null ? "" :
                isToday ? "bg-primary text-white font-bold" :
                hasPost ? "bg-white/[0.04] text-white/80 hover:bg-primary/15 border border-primary/15" :
                "text-muted-foreground/50 hover:bg-white/[0.04] hover:text-white/60"
              }`}
              style={isToday ? { boxShadow: "0 0 15px rgba(124, 58, 237, 0.5)" } : undefined}
            >
              {day}
              {hasPost && !isToday ? (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" style={{ boxShadow: "0 0 4px rgba(124, 58, 237, 0.5)" }} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingScheduling() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-16 w-72 rounded-xl bg-white/[0.05]" />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.75fr)_minmax(360px,1fr)] gap-4">
        <div className="space-y-4">
          <div className="glass-card h-80" />
          <div className="glass-card h-72" />
        </div>
        <div className="glass-card h-[640px]" />
      </div>
    </div>
  );
}

export default function Scheduling() {
  const accountsQuery = useListAccounts();
  const postsQuery = useListPosts();
  const videosQuery = useListVideos();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("All");
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [duplicateUpload, setDuplicateUpload] = useState<DuplicateUpload | null>(null);
  const [isBulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const accounts = accountsQuery.data?.data ?? [];
  const posts = postsQuery.data?.data ?? [];
  const videos = videosQuery.data?.data ?? [];
  const availableVideos = videos.filter((video) => video.status !== "failed");
  const [composerForm, setComposerForm] = useState<ComposerForm>(() => createInitialComposerForm(accounts, availableVideos));
  const scheduledPosts = posts.filter((post) => post.status === "scheduled");
  const cancelledPosts = posts.filter((post) => post.status === "cancelled");
  const isLoading = accountsQuery.isLoading || postsQuery.isLoading || videosQuery.isLoading;
  const isError = accountsQuery.isError || postsQuery.isError || videosQuery.isError;
  const error = accountsQuery.error ?? postsQuery.error ?? videosQuery.error;
  const createPostMutation = useCreatePost({
    mutation: {
      onSuccess: async (post) => {
        await queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        if (post?.accountId) {
          setSelectedAccountId(post.accountId);
        }
        setComposerOpen(false);
        setDuplicateUpload(null);
        setComposerForm(createInitialComposerForm(accounts, availableVideos));
        toast({
          title: "Post scheduled",
          description: "The publishing job was added to the queue.",
        });
      },
      onError: (error) => {
        toast({
          title: "Unable to schedule post",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    },
  });
  const uploadVideoMutation = useUploadVideo({
    mutation: {
      onSuccess: async (video) => {
        await queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
        setComposerForm((current) => ({
          ...current,
          videoId: video.id,
          uploadFile: null,
        }));
        setDuplicateUpload(null);
        toast({
          title: video.originalFilename ? `Uploaded ${video.originalFilename}` : "Video uploaded",
          description: "The upload is selected for this scheduled post.",
        });
      },
      onError: (error) => {
        const conflict = extractDuplicateConflict(error);
        if (conflict) {
          setDuplicateUpload(conflict);
          toast({
            title: "Duplicate filename",
            description: `You already uploaded ${conflict.filename}. Use the existing video or rename your file.`,
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Video upload failed",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    },
  });
  const deletePostMutation = useDeletePost({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        toast({
          title: "Post cancelled",
          description: "Removed from the queue. You can still see it under recently cancelled.",
        });
      },
      onError: (error) => {
        toast({
          title: "Unable to cancel post",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    },
  });

  // --- Scheduled Posts list (search + filters + pagination) ---
  type PostStatusFilter = "all" | "scheduled" | "posted" | "failed" | "cancelled";
  type PostPlatformFilter = "all" | AccountPlatform;
  const POSTS_PER_PAGE = 6;
  const [postSearch, setPostSearch] = useState("");
  const [postStatusFilter, setPostStatusFilter] = useState<PostStatusFilter>("scheduled");
  const [postPlatformFilter, setPostPlatformFilter] = useState<PostPlatformFilter>("all");
  const [postAccountFilter, setPostAccountFilter] = useState<string>("all");
  const [postPage, setPostPage] = useState(1);

  const accountById = useMemo(() => {
    const map = new Map<string, Account>();
    for (const account of accounts) map.set(account.id, account);
    return map;
  }, [accounts]);

  const filteredPosts = useMemo(() => {
    const query = postSearch.trim().toLowerCase();
    return posts
      .filter((post) => {
        if (postStatusFilter !== "all" && post.status !== postStatusFilter) return false;
        if (postPlatformFilter !== "all" && post.platform !== postPlatformFilter) return false;
        if (postAccountFilter !== "all" && post.accountId !== postAccountFilter) return false;
        if (query) {
          const title = (getStringMetadata(post, "title") ?? "").toLowerCase();
          const caption = (getStringMetadata(post, "caption") ?? getStringMetadata(post, "description") ?? "").toLowerCase();
          const accountName = (accountById.get(post.accountId)?.accountName ?? "").toLowerCase();
          if (!title.includes(query) && !caption.includes(query) && !accountName.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Upcoming first for scheduled; otherwise newest first.
        if (postStatusFilter === "scheduled") {
          return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        }
        return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
      });
  }, [posts, accountById, postSearch, postStatusFilter, postPlatformFilter, postAccountFilter]);

  useEffect(() => {
    setPostPage(1);
  }, [postSearch, postStatusFilter, postPlatformFilter, postAccountFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
  const currentPostPage = Math.min(postPage, totalPages);
  const paginatedPosts = filteredPosts.slice(
    (currentPostPage - 1) * POSTS_PER_PAGE,
    currentPostPage * POSTS_PER_PAGE,
  );
  const hasActivePostFilters =
    postSearch.trim().length > 0
    || postStatusFilter !== "scheduled"
    || postPlatformFilter !== "all"
    || postAccountFilter !== "all";

  const resetPostFilters = () => {
    setPostSearch("");
    setPostStatusFilter("scheduled");
    setPostPlatformFilter("all");
    setPostAccountFilter("all");
  };

  const postStatusStyles: Record<PostStatusFilter, { color: string; dot: string; label: string }> = {
    all: { color: "", dot: "", label: "All" },
    scheduled: { color: "text-primary bg-primary/10 border-primary/20", dot: "bg-primary", label: "Scheduled" },
    posted: { color: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20", dot: "bg-emerald-400", label: "Posted" },
    failed: { color: "text-red-300 bg-red-400/10 border-red-400/20", dot: "bg-red-400", label: "Failed" },
    cancelled: { color: "text-muted-foreground bg-white/[0.04] border-white/[0.08]", dot: "bg-white/40", label: "Cancelled" },
  };

  const visiblePageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }
    pages.push(1);
    const start = Math.max(2, currentPostPage - 1);
    const end = Math.min(totalPages - 1, currentPostPage + 1);
    if (start > 2) pages.push("ellipsis");
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (end < totalPages - 1) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }, [totalPages, currentPostPage]);

  const lanes: AccountLane[] = useMemo(() => accounts.map((account) => {
    const accountPosts = posts.filter((post) => post.accountId === account.id);
    const scheduled = accountPosts.filter((post) => post.status === "scheduled");
    const posted = accountPosts.filter((post) => post.status === "posted");
    const failed = accountPosts.filter((post) => post.status === "failed");
    const lastPostAt = [...accountPosts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt ?? null;

    return {
      account,
      scheduled,
      posted,
      failed,
      status: getAccountStatus(account, scheduled, failed),
      lastPostAt,
    };
  }), [accounts, posts]);

  const visibleLanes = lanes.filter((lane) => {
    if (pipelineFilter === "Active") {
      return lane.status === "Active";
    }

    if (pipelineFilter === "Attention") {
      return lane.status === "Attention";
    }

    return true;
  });

  const activeLane = visibleLanes.find((lane) => lane.account.id === selectedAccountId)
    ?? lanes.find((lane) => lane.account.id === selectedAccountId)
    ?? visibleLanes[0]
    ?? lanes[0]
    ?? null;
  const activePost = activeLane?.scheduled[0] ?? null;
  const fallbackCaption = getStringMetadata(activePost, "description")
    ?? getStringMetadata(activePost, "caption")
    ?? getStringMetadata(activePost, "title")
    ?? "Scheduled post metadata will appear here when available.";

  // While the composer is open, the phone preview reflects what's being typed,
  // not the next scheduled post. Falls back to the active lane state otherwise.
  const composerAccount = composerForm.accountId
    ? accounts.find((account) => account.id === composerForm.accountId) ?? null
    : null;
  const useComposerPreview = isComposerOpen && composerAccount !== null;
  const previewAccount = useComposerPreview ? composerAccount! : activeLane?.account ?? null;
  const previewCaption = useComposerPreview
    ? (composerForm.caption.trim() || composerForm.title.trim() || "Your caption will appear here as you type.")
    : fallbackCaption;
  const previewScheduledAt = useComposerPreview
    ? (composerForm.scheduledAt ? new Date(composerForm.scheduledAt).toISOString() : null)
    : (activePost?.scheduledAt ?? null);
  const recentCancelledPosts = [...cancelledPosts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const handleFilterToggle = () => {
    const nextFilter = pipelineFilter === "All" ? "Attention" : pipelineFilter === "Attention" ? "Active" : "All";

    setPipelineFilter(nextFilter);
    toast({
      title: `Pipeline filter: ${nextFilter}`,
      description: nextFilter === "All"
        ? "Showing every publishing lane."
        : nextFilter === "Attention"
          ? "Showing expired tokens and failed post lanes."
          : "Showing only lanes with scheduled work.",
    });
  };

  const openComposer = () => {
    setComposerForm((current) => ({
      ...createInitialComposerForm(accounts, availableVideos),
      accountId: selectedAccountId ?? current.accountId ?? accounts[0]?.id ?? "",
    }));
    setDuplicateUpload(null);
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setDuplicateUpload(null);
  };

  const handleUploadSelectedVideo = () => {
    if (!composerForm.uploadFile) {
      toast({
        title: "Choose a video file",
        description: "Select a local video before uploading.",
        variant: "destructive",
      });
      return;
    }

    uploadVideoMutation.mutate({
      data: {
        file: composerForm.uploadFile,
      },
    });
  };

  const openBulk = () => {
    setBulkRows([]);
    setBulkOpen(true);
  };

  const closeBulk = () => {
    if (bulkSubmitting) return;
    setBulkOpen(false);
    setBulkRows([]);
  };

  const downloadBulkTemplate = () => {
    const csv = BULK_CSV_TEMPLATE_HEADER + BULK_CSV_TEMPLATE_EXAMPLE;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bviral-bulk-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBulkFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const rows = parseCsvText(text);
    if (rows.length < 2) {
      toast({
        title: "Empty CSV",
        description: "Add at least one data row beneath the header.",
        variant: "destructive",
      });
      return;
    }

    const header = rows[0].map((cell) => cell.trim().toLowerCase());
    const need = (name: string) => {
      const idx = header.indexOf(name);
      if (idx < 0) throw new Error(`Missing required column "${name}"`);
      return idx;
    };

    let accountCol: number;
    let scheduledCol: number;
    let videoCol: number;
    try {
      accountCol = need("account_name");
      scheduledCol = need("scheduled_at");
      videoCol = need("video_filename");
    } catch (error) {
      toast({
        title: "Invalid CSV header",
        description: getErrorMessage(error),
        variant: "destructive",
      });
      return;
    }

    const titleCol = header.indexOf("title");
    const captionCol = header.indexOf("caption");
    const platformCol = header.indexOf("platform");

    const accountByName = new Map(accounts.map((a) => [a.accountName.toLowerCase(), a]));
    const videoByFilename = new Map<string, Video>();
    for (const video of videos) {
      if (video.originalFilename) {
        videoByFilename.set(video.originalFilename.toLowerCase(), video);
      }
    }

    const now = Date.now();
    const parsed: BulkRow[] = rows.slice(1).map((cells, index) => {
      const accountName = (cells[accountCol] ?? "").trim();
      const scheduledRaw = (cells[scheduledCol] ?? "").trim();
      const videoFilename = (cells[videoCol] ?? "").trim();
      const title = titleCol >= 0 ? (cells[titleCol] ?? "").trim() : "";
      const caption = captionCol >= 0 ? (cells[captionCol] ?? "").trim() : "";
      const platformOverride = platformCol >= 0 ? (cells[platformCol] ?? "").trim().toLowerCase() : "";

      const row: BulkRow = {
        row: index + 2,
        accountName,
        scheduledAt: scheduledRaw,
        videoFilename,
        title,
        caption,
        status: "valid",
      };

      const account = accountByName.get(accountName.toLowerCase());
      if (!account) {
        row.status = "invalid";
        row.reason = `Account "${accountName}" not found`;
        return row;
      }

      const video = videoByFilename.get(videoFilename.toLowerCase());
      if (!video) {
        row.status = "invalid";
        row.reason = `Video filename "${videoFilename}" not found`;
        return row;
      }

      const scheduledDate = new Date(scheduledRaw);
      if (Number.isNaN(scheduledDate.getTime())) {
        row.status = "invalid";
        row.reason = `Invalid scheduled time "${scheduledRaw}"`;
        return row;
      }

      if (scheduledDate.getTime() <= now + 60_000) {
        row.status = "invalid";
        row.reason = "Scheduled time must be at least a minute in the future";
        return row;
      }

      if (platformOverride && platformOverride !== account.platform) {
        row.status = "invalid";
        row.reason = `platform "${platformOverride}" doesn't match account platform "${account.platform}"`;
        return row;
      }

      row.resolved = { account, video, scheduledAt: scheduledDate };
      return row;
    });

    setBulkRows(parsed);
  };

  const submitBulk = async () => {
    const valid = bulkRows.filter((row) => row.status === "valid" && row.resolved);
    if (valid.length === 0) {
      toast({
        title: "Nothing to schedule",
        description: "No rows passed validation.",
        variant: "destructive",
      });
      return;
    }

    setBulkSubmitting(true);
    let succeeded = 0;
    let failed = 0;

    for (const row of valid) {
      if (!row.resolved) continue;
      try {
        await createPostMutation.mutateAsync({
          data: {
            account_id: row.resolved.account.id,
            video_id: row.resolved.video.id,
            platform: row.resolved.account.platform,
            scheduled_at: row.resolved.scheduledAt.toISOString(),
            metadata: {
              title: row.title || "BVIRAL scheduled video",
              description: row.caption,
              caption: row.caption,
              source: "bulk-csv",
            },
          },
        });
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }

    setBulkSubmitting(false);
    toast({
      title: `${succeeded} scheduled, ${failed} failed`,
      description: failed === 0 ? "All rows queued." : "Some rows failed — see toasts for details.",
      variant: failed > 0 ? "destructive" : undefined,
    });
    if (failed === 0) {
      setBulkOpen(false);
      setBulkRows([]);
    }
  };

  const handleSchedulePost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const account = accounts.find((entry) => entry.id === composerForm.accountId);

    if (!account) {
      toast({
        title: "Select an account",
        description: "Connect or select an account before scheduling.",
        variant: "destructive",
      });
      return;
    }

    if (!composerForm.videoId && !composerForm.uploadFile) {
      toast({
        title: "Select a video",
        description: "Choose an uploaded video or select a local video file.",
        variant: "destructive",
      });
      return;
    }

    const scheduledAt = new Date(composerForm.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      toast({
        title: "Choose a future time",
        description: "Scheduled posts must be set for a future date and time.",
        variant: "destructive",
      });
      return;
    }

    try {
      const videoId = composerForm.uploadFile
        ? (await uploadVideoMutation.mutateAsync({
          data: {
            file: composerForm.uploadFile,
          },
        })).id
        : composerForm.videoId;

      await createPostMutation.mutateAsync({
        data: {
          account_id: account.id,
          video_id: videoId,
          platform: account.platform,
          scheduled_at: scheduledAt.toISOString(),
          metadata: {
            title: composerForm.title.trim() || "BVIRAL scheduled video",
            description: composerForm.caption.trim(),
            caption: composerForm.caption.trim(),
          },
        },
      });
    } catch {
      // Mutation handlers show the specific toast.
    }
  };

  if (isLoading) {
    return <LoadingScheduling />;
  }

  if (isError) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/15 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-red-400" />
        </div>
        <p className="text-white/70 font-medium text-sm">Unable to load scheduling data</p>
        <p className="text-muted-foreground/40 text-xs mt-1">{getErrorMessage(error)}</p>
        <button
          onClick={() => {
            accountsQuery.refetch();
            postsQuery.refetch();
          }}
          className="btn-secondary inline-flex items-center gap-2 mt-5"
        >
          <RefreshCcw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-primary/10 flex items-center justify-center border border-cyan-500/10">
              <Layers className="w-5 h-5 text-cyan-400" />
            </div>
            <h1 className="page-title mb-0">Scheduling Engine</h1>
          </div>
          <p className="page-subtitle ml-[52px]">Manage real scheduled posts across connected accounts.</p>
        </div>
        <div className="flex gap-2 ml-[52px] sm:ml-0">
          <button
            onClick={openBulk}
            className="btn-secondary flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" /> Bulk CSV
          </button>
          <button
            onClick={openComposer}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Post
          </button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card flex flex-col">
        <div className="p-4 border-b border-white/[0.04] flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/10">
                <ListFilter className="w-3.5 h-3.5 text-primary" />
              </div>
              <h2 className="font-display font-bold text-white text-sm">Scheduled Posts</h2>
              <span className="text-[11px] text-muted-foreground/50">
                {filteredPosts.length} {filteredPosts.length === 1 ? "result" : "results"}
              </span>
            </div>
            {hasActivePostFilters ? (
              <button
                type="button"
                onClick={resetPostFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
              >
                <XCircle className="w-3 h-3" /> Clear filters
              </button>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="search"
                value={postSearch}
                onChange={(event) => setPostSearch(event.target.value)}
                placeholder="Search by account, title, or caption..."
                className="h-9 w-full rounded-lg border border-white/[0.08] bg-black/25 pl-8 pr-3 text-xs text-white outline-none transition placeholder:text-white/30 focus:border-primary/40"
              />
            </div>

            <Select value={postStatusFilter} onValueChange={(value) => setPostStatusFilter(value as PostStatusFilter)}>
              <SelectTrigger className="h-9 w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 text-xs text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={postPlatformFilter} onValueChange={(value) => setPostPlatformFilter(value as PostPlatformFilter)}>
              <SelectTrigger className="h-9 w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 text-xs text-white">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                {(Object.keys(platformLabels) as AccountPlatform[]).map((platform) => (
                  <SelectItem key={platform} value={platform}>{platformLabels[platform]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={postAccountFilter} onValueChange={setPostAccountFilter}>
              <SelectTrigger className="h-9 w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 text-xs text-white">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>{account.accountName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-auto">
          {paginatedPosts.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-white/60 font-medium text-sm">No posts match these filters.</p>
              <p className="text-muted-foreground/40 text-xs mt-1">
                {posts.length === 0 ? "Schedule your first post to see it here." : "Try clearing filters or widening the status."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-black/20 text-muted-foreground/50">
                <tr>
                  <th className="p-3 pl-5 font-medium text-[11px] uppercase tracking-wider">Account</th>
                  <th className="p-3 font-medium text-[11px] uppercase tracking-wider">Platform</th>
                  <th className="p-3 font-medium text-[11px] uppercase tracking-wider">Title / Caption</th>
                  <th className="p-3 font-medium text-[11px] uppercase tracking-wider">Scheduled</th>
                  <th className="p-3 font-medium text-[11px] uppercase tracking-wider">Status</th>
                  <th className="p-3 pr-5 font-medium text-[11px] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {paginatedPosts.map((post) => {
                  const account = accountById.get(post.accountId);
                  const title = getStringMetadata(post, "title");
                  const caption = getStringMetadata(post, "caption") ?? getStringMetadata(post, "description");
                  const statusStyle = postStatusStyles[post.status as PostStatusFilter] ?? postStatusStyles.scheduled;
                  const canCancel = post.status === "scheduled";
                  return (
                    <tr
                      key={post.id}
                      onClick={() => account && setSelectedAccountId(account.id)}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="p-3 pl-5 font-semibold text-white/90 whitespace-nowrap">
                        {account?.accountName ?? <span className="text-muted-foreground/50">Unknown</span>}
                      </td>
                      <td className="p-3">
                        <PlatformBadge platform={post.platform} />
                      </td>
                      <td className="p-3 min-w-[200px] max-w-[340px]">
                        <p className="text-white/85 text-xs font-medium truncate">{title ?? "Untitled post"}</p>
                        {caption ? (
                          <p className="text-muted-foreground/50 text-[11px] truncate mt-0.5">{caption}</p>
                        ) : null}
                      </td>
                      <td className="p-3 text-white/75 font-mono text-[11px] whitespace-nowrap">
                        {formatDateTime(post.scheduledAt)}
                      </td>
                      <td className="p-3">
                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border w-fit ${statusStyle.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="p-3 pr-5 text-right">
                        {canCancel ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              deletePostMutation.mutate({ id: post.id });
                            }}
                            disabled={deletePostMutation.isPending}
                            className="inline-flex items-center gap-1.5 rounded-md border border-red-400/20 bg-red-400/[0.06] px-2 py-1 text-[10px] font-semibold text-red-200 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" /> Cancel
                          </button>
                        ) : (
                          <span className="text-muted-foreground/40 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="px-4 py-3 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground/55">
              Page <span className="text-white/80 font-semibold">{currentPostPage}</span> of {totalPages}
              <span className="mx-2 text-muted-foreground/30">·</span>
              Showing {(currentPostPage - 1) * POSTS_PER_PAGE + 1}
              –{Math.min(currentPostPage * POSTS_PER_PAGE, filteredPosts.length)} of {filteredPosts.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPostPage((page) => Math.max(1, page - 1))}
                disabled={currentPostPage === 1}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="w-3 h-3" /> Prev
              </button>
              {visiblePageNumbers.map((page, index) =>
                page === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="px-1 text-[11px] text-muted-foreground/40">…</span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setPostPage(page)}
                    className={cn(
                      "h-7 min-w-7 rounded-md border px-2 text-[11px] font-semibold transition",
                      page === currentPostPage
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    {page}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setPostPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPostPage === totalPages}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : null}
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.75fr)_minmax(360px,1fr)] gap-4">
        <div className="flex flex-col gap-4 min-w-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card flex flex-col">
            <div className="p-4 border-b border-white/[0.04] flex justify-between items-center sticky top-0 bg-card/80 backdrop-blur-md z-10">
              <h2 className="font-display font-bold text-white text-sm">Publishing Lanes</h2>
              <button
                onClick={handleFilterToggle}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground/50 hover:text-white transition-colors cursor-pointer"
                title={`Current filter: ${pipelineFilter}`}
              >
                <Filter className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-black/20 text-muted-foreground/50 sticky top-0">
                  <tr>
                    <th className="p-3 pl-5 font-medium text-[11px] uppercase tracking-wider">Account</th>
                    <th className="p-3 font-medium text-[11px] uppercase tracking-wider">Platform</th>
                    <th className="p-3 font-medium text-[11px] uppercase tracking-wider">Queued</th>
                    <th className="p-3 font-medium text-[11px] uppercase tracking-wider">Last Activity</th>
                    <th className="p-3 font-medium text-[11px] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {visibleLanes.map((lane) => {
                    const status = statusConfig[lane.status];
                    return (
                      <tr
                        key={lane.account.id}
                        onClick={() => setSelectedAccountId(lane.account.id)}
                        className={`hover:bg-white/[0.02] cursor-pointer transition-colors ${activeLane?.account?.id === lane.account.id ? "bg-primary/[0.04] border-l-2 border-l-primary" : "border-l-2 border-l-transparent"}`}
                      >
                        <td className="p-3 pl-5 font-semibold text-white/90">{lane.account.accountName}</td>
                        <td className="p-3">
                          <PlatformBadge platform={lane.account.platform} />
                        </td>
                        <td className="p-3 text-white/80 font-mono text-xs">{lane.scheduled.length}</td>
                        <td className="p-3 text-muted-foreground/50 text-xs">{timeAgo(lane.lastPostAt)}</td>
                        <td className="p-3">
                          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border w-fit ${status.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {lane.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleLanes.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-white/60 font-medium text-sm">No lanes match this filter.</p>
                  <p className="text-muted-foreground/40 text-xs mt-1">Try another pipeline view.</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <MiniCalendar scheduledPosts={scheduledPosts} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-5 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display font-bold text-white text-sm flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/10">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                </div>
                Next 24 Hours
              </h2>
            </div>
            <div className="relative bg-black/20 rounded-xl border border-white/[0.04] p-4">
              <div className="space-y-2">
                {scheduledPosts
                  .filter((post) => new Date(post.scheduledAt).getTime() <= Date.now() + 24 * 60 * 60 * 1000)
                  .slice(0, 6)
                  .map((post) => (
                    <div key={post.id} className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <PlatformBadge platform={post.platform} />
                        <span className="font-mono text-primary">{formatDateTime(post.scheduledAt)}</span>
                      </div>
                    </div>
                  ))}
                {scheduledPosts.filter((post) => new Date(post.scheduledAt).getTime() <= Date.now() + 24 * 60 * 60 * 1000).length === 0 && (
                  <div className="flex h-full items-center justify-center text-sm text-white/46">No posts scheduled in the next 24 hours.</div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="min-w-0 space-y-4">
          <div className="glass-card p-5">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="font-display font-bold text-white text-sm">Post Preview</h2>
                <p className="text-[11px] text-muted-foreground/50 mt-1">
                  {useComposerPreview ? "Live preview from the composer" : "Selected account and next scheduled post"}
                </p>
              </div>
              <button
                onClick={() => toast({ title: "Preview actions", description: previewAccount ? `Review tools opened for ${previewAccount.accountName}.` : "No lane selected." })}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground/50 hover:text-white transition-colors cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            {previewAccount ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/40 font-bold">Queue</p>
                    <p className="mt-2 text-lg font-display font-bold text-white">{activeLane?.scheduled.length ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground/50">scheduled posts</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/40 font-bold">Channel</p>
                    <p className="mt-2 text-lg font-display font-bold text-white">{platformLabels[previewAccount.platform]}</p>
                    <p className="text-[11px] text-muted-foreground/50">{previewAccount.accountName}</p>
                  </div>
                </div>

                <div className="border-[3px] border-white/[0.08] rounded-[2.5rem] bg-black relative overflow-hidden mx-auto w-full max-w-[290px] aspect-[10/17]" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 25px 50px rgba(0,0,0,0.5)" }}>
                  <div className="absolute top-3 left-0 right-0 flex justify-center z-20">
                    <div className="w-[90px] h-[22px] bg-black rounded-full border border-white/[0.04]" />
                  </div>
                  <div className="absolute inset-0 group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/70 via-zinc-900/50 to-zinc-950/70" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300 border border-white/10">
                        <Play className="w-6 h-6 text-white ml-1" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16">
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {previewAccount.accountName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-white text-[13px]">{previewAccount.accountName}</span>
                      </div>
                      <p className="text-white/80 text-xs leading-relaxed line-clamp-3 mb-2">{previewCaption}</p>
                      <p className="text-primary text-[11px] font-bold">#{previewAccount.platform} #{useComposerPreview ? "draft" : "scheduled"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Delivery Plan</span>
                  </div>
                  <div className="flex justify-between text-xs gap-3">
                    <span className="text-muted-foreground/50">Scheduled for:</span>
                    <span className="text-white/80 font-medium text-right">{previewScheduledAt ? formatDateTime(previewScheduledAt) : "No scheduled post"}</span>
                  </div>
                  <div className="flex justify-between text-xs gap-3">
                    <span className="text-muted-foreground/50">Platform:</span>
                    <PlatformBadge platform={previewAccount.platform} />
                  </div>
                  <button
                    onClick={() => activePost
                      ? deletePostMutation.mutate({ id: activePost.id })
                      : toast({ title: "No scheduled post", description: "There is no queued post to cancel." })}
                    disabled={!activePost || deletePostMutation.isPending}
                    className="w-full py-2.5 mt-2 border border-red-400/20 hover:bg-red-400/10 hover:border-red-400/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-red-200 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {deletePostMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Cancel Scheduled Post
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-white/60 font-medium text-sm">No connected accounts yet.</p>
                <p className="text-muted-foreground/40 text-xs mt-1">Connect accounts before scheduling posts.</p>
              </div>
            )}
          </div>

          {recentCancelledPosts.length > 0 ? (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-white text-sm">Recently cancelled</h3>
                <span className="text-[10px] text-muted-foreground/40">{cancelledPosts.length} total</span>
              </div>
              <div className="space-y-2">
                {recentCancelledPosts.map((post) => (
                  <div key={post.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <PlatformBadge platform={post.platform} className="h-5 w-5" iconClassName="h-3 w-3" />
                      <span className="text-white/70 truncate">was scheduled {formatDateTime(post.scheduledAt)}</span>
                    </div>
                    <span className="text-muted-foreground/50 shrink-0">{timeAgo(post.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </motion.div>
      </div>

      {isComposerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-4xl rounded-2xl border border-white/[0.08] bg-card p-5 shadow-2xl my-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-post-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-4">
              <div>
                <h2 id="schedule-post-title" className="font-display text-lg font-bold text-white">Schedule post</h2>
                <p className="mt-1 text-xs text-muted-foreground/55">Choose the account, video, and delivery time for the publishing worker.</p>
              </div>
              <button
                type="button"
                onClick={closeComposer}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/60 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Close scheduler"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(220px,1fr)]">
            <form onSubmit={handleSchedulePost} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Account</span>
                  <Select
                    value={composerForm.accountId || undefined}
                    onValueChange={(value) => setComposerForm((current) => ({ ...current, accountId: value }))}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.accountName} — {platformLabels[account.platform]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Schedule time</span>
                  <input
                    type="datetime-local"
                    value={composerForm.scheduledAt}
                    min={toDateTimeLocalValue(new Date(Date.now() + 60_000))}
                    onChange={(event) => setComposerForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none transition focus:border-primary/40"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Video</span>
                  <Select
                    value={composerForm.videoId || undefined}
                    onValueChange={(value) => setComposerForm((current) => ({ ...current, videoId: value }))}
                    disabled={availableVideos.length === 0}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white">
                      <SelectValue placeholder={availableVideos.length > 0 ? "Select uploaded video" : "No uploaded videos"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVideos.map((video) => (
                        <SelectItem key={video.id} value={video.id}>
                          {getVideoLabel(video)} — {video.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground/45">Select an existing upload, or choose a local file and Schedule will upload it first.</p>
                </div>

                <div className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Upload new</span>
                  <div className="flex gap-2">
                    <label className="flex h-11 min-w-0 cursor-pointer items-center rounded-xl border border-white/[0.08] bg-black/25 px-3 text-xs text-white/70 transition hover:bg-white/[0.04]">
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(event) => setComposerForm((current) => ({ ...current, uploadFile: event.target.files?.[0] ?? null }))}
                      />
                      <span className="max-w-[150px] truncate">{composerForm.uploadFile?.name ?? "Choose file"}</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleUploadSelectedVideo}
                      disabled={!composerForm.uploadFile || uploadVideoMutation.isPending}
                      className="flex h-11 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/12 px-3 text-xs font-semibold text-primary transition hover:bg-primary/18 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploadVideoMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                      Upload
                    </button>
                  </div>
                </div>
              </div>

              {duplicateUpload ? (
                <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        You already uploaded <span className="text-amber-200">{duplicateUpload.filename}</span>
                      </p>
                      <p className="text-[11px] text-white/60 mt-1">
                        Uploaded {timeAgo(duplicateUpload.existing.createdAt)}. Use the existing video, or rename your file and try again.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setComposerForm((current) => ({ ...current, videoId: duplicateUpload.existing.id, uploadFile: null }));
                        setDuplicateUpload(null);
                        toast({ title: "Using existing video", description: duplicateUpload.filename });
                      }}
                      className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-300/15"
                    >
                      Use existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateUpload(null)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/60 transition hover:bg-white/[0.06]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Title</span>
                  <input
                    value={composerForm.title}
                    onChange={(event) => setComposerForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="BVIRAL scheduled video"
                    maxLength={100}
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-primary/40"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Caption</span>
                  <textarea
                    value={composerForm.caption}
                    onChange={(event) => setComposerForm((current) => ({ ...current, caption: event.target.value }))}
                    placeholder="Caption, hashtags, or publishing notes"
                    rows={3}
                    className="min-h-11 w-full resize-none rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-primary/40"
                  />
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeComposer}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPostMutation.isPending || uploadVideoMutation.isPending || accounts.length === 0}
                  className="btn-primary flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createPostMutation.isPending || uploadVideoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {uploadVideoMutation.isPending ? "Uploading Video" : createPostMutation.isPending ? "Scheduling" : "Schedule Post"}
                </button>
              </div>
            </form>

            <aside className="rounded-2xl border border-white/[0.06] bg-black/20 p-4 flex flex-col gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/40 font-bold">Live preview</p>
                <p className="text-[11px] text-muted-foreground/50 mt-1">Updates as you type</p>
              </div>
              {composerAccount ? (
                <>
                  <div
                    className="border-[3px] border-white/[0.08] rounded-[1.8rem] bg-black relative overflow-hidden mx-auto w-full max-w-[210px] aspect-[10/17]"
                    style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 18px 36px rgba(0,0,0,0.5)" }}
                  >
                    <div className="absolute top-2 left-0 right-0 flex justify-center z-20">
                      <div className="w-[70px] h-[18px] bg-black rounded-full border border-white/[0.04]" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/70 via-zinc-900/50 to-zinc-950/70" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                          {composerAccount.accountName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-white text-[11px] truncate">{composerAccount.accountName}</span>
                      </div>
                      <p className="text-white/80 text-[10px] leading-snug line-clamp-3 mb-1">
                        {composerForm.caption.trim() || composerForm.title.trim() || "Your caption will appear here as you type."}
                      </p>
                      <p className="text-primary text-[9px] font-bold">#{composerAccount.platform} #draft</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs space-y-2">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground/50">Platform</span>
                      <PlatformBadge platform={composerAccount.platform} className="h-5 w-5" iconClassName="h-3 w-3" />
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground/50">Posting at</span>
                      <span className="text-white/80 font-medium text-right text-[11px]">
                        {composerForm.scheduledAt
                          ? formatDateTime(new Date(composerForm.scheduledAt).toISOString())
                          : "Choose a time"}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-xs text-muted-foreground/45">
                  Choose an account to see the preview.
                </div>
              )}
            </aside>
            </div>
          </motion.div>
        </div>
      ) : null}

      {isBulkOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-3xl rounded-2xl border border-white/[0.08] bg-card p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-csv-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-4">
              <div>
                <h2 id="bulk-csv-title" className="font-display text-lg font-bold text-white">Bulk schedule from CSV</h2>
                <p className="mt-1 text-xs text-muted-foreground/55">
                  Upload a CSV referencing existing accounts and uploaded videos. Each valid row becomes a scheduled post.
                </p>
              </div>
              <button
                type="button"
                onClick={closeBulk}
                disabled={bulkSubmitting}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                aria-label="Close bulk import"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <button
                  type="button"
                  onClick={downloadBulkTemplate}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06]"
                >
                  <Download className="h-3.5 w-3.5" /> Download template
                </button>
                <label className="inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/12 px-3 py-2 text-xs font-semibold text-primary cursor-pointer transition hover:bg-primary/18">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      handleBulkFile(file);
                    }}
                  />
                  <UploadCloud className="h-3.5 w-3.5" /> Choose CSV
                </label>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-black/20">
                <div className="px-4 py-3 border-b border-white/[0.04] text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/45 flex items-center justify-between">
                  <span>Parsed rows</span>
                  <span className="text-muted-foreground/60 normal-case tracking-normal">
                    {bulkRows.length === 0
                      ? "No file loaded"
                      : `${bulkRows.filter((r) => r.status === "valid").length} valid · ${bulkRows.filter((r) => r.status === "invalid").length} invalid`}
                  </span>
                </div>
                <div className="max-h-[320px] overflow-auto">
                  {bulkRows.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground/45">
                      Choose a CSV file. Required columns: <span className="font-mono">account_name, scheduled_at, video_filename</span>. Optional: <span className="font-mono">title, caption, platform</span>.
                    </div>
                  ) : (
                    <table className="w-full text-left text-[12px]">
                      <thead className="bg-black/30 text-[10px] uppercase tracking-wider text-muted-foreground/50">
                        <tr>
                          <th className="px-3 py-2 font-medium">#</th>
                          <th className="px-3 py-2 font-medium">Account</th>
                          <th className="px-3 py-2 font-medium">Scheduled</th>
                          <th className="px-3 py-2 font-medium">Video</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {bulkRows.map((row) => (
                          <tr key={row.row} className={cn(row.status === "invalid" && "bg-red-500/[0.04]")}>
                            <td className="px-3 py-2 text-muted-foreground/50 font-mono">{row.row}</td>
                            <td className="px-3 py-2 text-white/80">{row.accountName || <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="px-3 py-2 text-white/70 font-mono text-[11px]">{row.scheduledAt || <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="px-3 py-2 text-white/80">{row.videoFilename || <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="px-3 py-2">
                              {row.status === "valid" ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                  <CheckCircle2 className="h-3 w-3" /> valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-300" title={row.reason}>
                                  <X className="h-3 w-3" /> {row.reason ?? "invalid"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeBulk}
                  disabled={bulkSubmitting}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitBulk}
                  disabled={bulkSubmitting || bulkRows.filter((r) => r.status === "valid").length === 0}
                  className="btn-primary flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {bulkSubmitting ? "Scheduling..." : `Schedule ${bulkRows.filter((r) => r.status === "valid").length} ${bulkRows.filter((r) => r.status === "valid").length === 1 ? "post" : "posts"}`}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
