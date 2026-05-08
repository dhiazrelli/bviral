import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Layers,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
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
  const url = video.processedUrl ?? video.originalUrl;

  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").filter(Boolean).at(-1);
    return filename ? decodeURIComponent(filename) : video.id.slice(0, 8);
  } catch {
    return video.id.slice(0, 8);
  }
}

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
  const accounts = accountsQuery.data?.data ?? [];
  const posts = postsQuery.data?.data ?? [];
  const videos = videosQuery.data?.data ?? [];
  const availableVideos = videos.filter((video) => video.status !== "failed");
  const [composerForm, setComposerForm] = useState<ComposerForm>(() => createInitialComposerForm(accounts, availableVideos));
  const scheduledPosts = posts.filter((post) => post.status === "scheduled");
  const isLoading = accountsQuery.isLoading || postsQuery.isLoading || videosQuery.isLoading;
  const isError = accountsQuery.isError || postsQuery.isError || videosQuery.isError;
  const error = accountsQuery.error ?? postsQuery.error ?? videosQuery.error;
  const createPostMutation = useCreatePost({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        setComposerOpen(false);
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
        toast({
          title: "Video uploaded",
          description: "The upload is selected for this scheduled post.",
        });
      },
      onError: (error) => {
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
          title: "Scheduled post cancelled",
          description: "The delayed publishing job was removed.",
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
  const previewCaption = getStringMetadata(activePost, "description")
    ?? getStringMetadata(activePost, "caption")
    ?? getStringMetadata(activePost, "title")
    ?? "Scheduled post metadata will appear here when available.";

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
    setComposerOpen(true);
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

  const handleSchedulePost = (event: React.FormEvent<HTMLFormElement>) => {
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

    if (!composerForm.videoId) {
      toast({
        title: "Select a video",
        description: "Upload or select a video before scheduling.",
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

    createPostMutation.mutate({
      data: {
        account_id: account.id,
        video_id: composerForm.videoId,
        platform: account.platform,
        scheduled_at: scheduledAt.toISOString(),
        metadata: {
          title: composerForm.title.trim() || "BVIRAL scheduled video",
          description: composerForm.caption.trim(),
          caption: composerForm.caption.trim(),
        },
      },
    });
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
            onClick={() => toast({ title: "Bulk import", description: "CSV ingest is not wired in this pass." })}
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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.75fr)_minmax(360px,1fr)] gap-4 flex-1 min-h-0">
        <div className="flex flex-col gap-4 h-full min-w-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card flex flex-col flex-shrink-0 max-h-[50%]">
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
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${platformColors[lane.account.platform]}`}>
                            {platformLabels[lane.account.platform]}
                          </span>
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

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-5 flex flex-col h-[260px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display font-bold text-white text-sm flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/10">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                </div>
                Next 24 Hours
              </h2>
            </div>
            <div className="relative flex-1 bg-black/20 rounded-xl border border-white/[0.04] p-4 overflow-auto">
              <div className="space-y-2">
                {scheduledPosts
                  .filter((post) => new Date(post.scheduledAt).getTime() <= Date.now() + 24 * 60 * 60 * 1000)
                  .slice(0, 6)
                  .map((post) => (
                    <div key={post.id} className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-white">{platformLabels[post.platform]}</span>
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

        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="self-start min-w-0">
          <div className="glass-card p-5 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7.5rem)] xl:overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="font-display font-bold text-white text-sm">Post Preview</h2>
                <p className="text-[11px] text-muted-foreground/50 mt-1">Selected account and next scheduled post</p>
              </div>
              <button
                onClick={() => toast({ title: "Preview actions", description: activeLane ? `Review tools opened for ${activeLane.account.accountName}.` : "No lane selected." })}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground/50 hover:text-white transition-colors cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            {activeLane ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/40 font-bold">Queue</p>
                    <p className="mt-2 text-lg font-display font-bold text-white">{activeLane.scheduled.length}</p>
                    <p className="text-[11px] text-muted-foreground/50">scheduled posts</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/40 font-bold">Channel</p>
                    <p className="mt-2 text-lg font-display font-bold text-white">{platformLabels[activeLane.account.platform]}</p>
                    <p className="text-[11px] text-muted-foreground/50">{activeLane.account.accountName}</p>
                  </div>
                </div>

                <div className="border-[3px] border-white/[0.08] rounded-[2.5rem] bg-black relative overflow-hidden mx-auto w-full max-w-[290px] aspect-[10/17]" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 25px 50px rgba(0,0,0,0.5)" }}>
                  <div className="absolute top-3 left-0 right-0 flex justify-center z-20">
                    <div className="w-[90px] h-[22px] bg-black rounded-full border border-white/[0.04]" />
                  </div>
                  <div className="absolute inset-0 group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/60 via-purple-900/40 to-slate-900/60" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300 border border-white/10">
                        <Play className="w-6 h-6 text-white ml-1" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16">
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {activeLane.account.accountName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-white text-[13px]">{activeLane.account.accountName}</span>
                      </div>
                      <p className="text-white/80 text-xs leading-relaxed line-clamp-3 mb-2">{previewCaption}</p>
                      <p className="text-primary text-[11px] font-bold">#{activeLane.account.platform} #scheduled</p>
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
                    <span className="text-white/80 font-medium text-right">{activePost ? formatDateTime(activePost.scheduledAt) : "No scheduled post"}</span>
                  </div>
                  <div className="flex justify-between text-xs gap-3">
                    <span className="text-muted-foreground/50">Platform:</span>
                    <span className={`px-2 h-5 rounded border flex items-center justify-center text-[9px] font-bold ${platformColors[activeLane.account.platform]}`}>
                      {platformLabels[activeLane.account.platform]}
                    </span>
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
        </motion.div>
      </div>
    </div>
  );
}
