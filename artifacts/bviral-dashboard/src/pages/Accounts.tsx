import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, MoreHorizontal, ShieldCheck,
  ShieldAlert, RefreshCcw, Trash2,
  CheckCircle2, Clock, X, UserPlus, Database, KeyRound,
  ExternalLink, Loader2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  connectMetaAccount,
  connectTikTokAccount,
  connectYouTubeAccount,
  getListAccountsQueryKey,
  useCreateAccount,
  useDeleteAccount,
  useListAccounts,
  type Account,
  type AccountPlatform,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type AccountStatus = "connected" | "expired";
type OAuthPlatform = "youtube" | "tiktok" | "meta";

const platformLabels: Record<AccountPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

const platformConfig: Record<AccountPlatform, { color: string; bg: string; border: string; gradient: string }> = {
  instagram: { color: "text-pink-400", bg: "bg-pink-500/8", border: "border-pink-500/15", gradient: "from-pink-500 to-purple-500" },
  tiktok: { color: "text-cyan-400", bg: "bg-cyan-500/8", border: "border-cyan-500/15", gradient: "from-cyan-400 to-blue-500" },
  youtube: { color: "text-red-400", bg: "bg-red-500/8", border: "border-red-500/15", gradient: "from-red-500 to-red-600" },
  snapchat: { color: "text-yellow-400", bg: "bg-yellow-500/8", border: "border-yellow-500/15", gradient: "from-yellow-400 to-amber-500" },
  facebook: { color: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/15", gradient: "from-blue-500 to-indigo-500" },
};

const statusConfig: Record<AccountStatus, { label: string; icon: React.ElementType; color: string; bg: string; dot: string }> = {
  connected: { label: "Connected", icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/15", dot: "bg-emerald-400" },
  expired: { label: "Token Expired", icon: ShieldAlert, color: "text-red-400", bg: "bg-red-400/10 border-red-400/15", dot: "bg-red-400" },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 400, damping: 25 } },
};

const manualPlatformOptions: AccountPlatform[] = ["facebook", "instagram", "tiktok", "youtube", "snapchat"];
const oauthOptions: Array<{
  id: OAuthPlatform;
  label: string;
  description: string;
  platforms: AccountPlatform[];
}> = [
  {
    id: "youtube",
    label: "YouTube",
    description: "Connect a YouTube channel with OAuth.",
    platforms: ["youtube"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    description: "Connect a TikTok creator account with OAuth.",
    platforms: ["tiktok"],
  },
  {
    id: "meta",
    label: "Meta",
    description: "Connect Facebook pages and Instagram accounts.",
    platforms: ["facebook", "instagram"],
  },
];

function getStringMetadata(account: Account, key: string): string | null {
  const value = account.metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getAccountHandle(account: Account) {
  return getStringMetadata(account, "handle")
    ?? getStringMetadata(account, "username")
    ?? getStringMetadata(account, "external_username")
    ?? account.id.slice(0, 8);
}

function getInitials(accountName: string) {
  const initials = accountName
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "AC";
}

function getAccountStatus(account: Account): AccountStatus {
  if (!account.tokenExpiry) {
    return "connected";
  }

  return new Date(account.tokenExpiry).getTime() > Date.now() ? "connected" : "expired";
}

function formatDate(value: string | null) {
  if (!value) {
    return "No expiry";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function isOAuthUrlResponse(value: unknown): value is { url: string } {
  return Boolean(
    value
      && typeof value === "object"
      && typeof (value as { url?: unknown }).url === "string"
      && (value as { url: string }).url.trim(),
  );
}

async function getOAuthConnectUrl(platform: OAuthPlatform) {
  const request = {
    headers: {
      accept: "application/json",
    },
    responseType: "json" as const,
  };
  const response = platform === "youtube"
    ? await connectYouTubeAccount(request)
    : platform === "tiktok"
      ? await connectTikTokAccount(request)
      : await connectMetaAccount(request);

  if (!isOAuthUrlResponse(response)) {
    throw new Error("The API did not return an OAuth connection URL.");
  }

  return response.url;
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="glass-card p-5 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-white/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-white/[0.08]" />
              <div className="h-2.5 w-20 rounded bg-white/[0.05]" />
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            <div className="h-5 w-20 rounded-md bg-white/[0.06]" />
            <div className="h-5 w-24 rounded-md bg-white/[0.06]" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="h-12 rounded-lg bg-white/[0.04]" />
            <div className="h-12 rounded-lg bg-white/[0.04]" />
            <div className="h-12 rounded-lg bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Accounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const accountsQuery = useListAccounts();
  const createAccountMutation = useCreateAccount({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        setShowAddModal(false);
        setManualForm({
          platform: "youtube",
          accountName: "",
          accessToken: "",
          refreshToken: "",
          tokenExpiry: "",
          metadata: "",
        });
        toast({
          title: "Account connected",
          description: "The account was added to your connected accounts.",
        });
      },
      onError: (error) => {
        toast({
          title: "Unable to connect account",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    },
  });
  const deleteAccountMutation = useDeleteAccount({
    mutation: {
      onSuccess: async (_, variables) => {
        if (selectedAccount === variables.id) {
          setSelectedAccount(null);
        }

        await queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        toast({
          title: "Account disconnected",
          description: "The account was removed from your connected accounts.",
        });
      },
      onError: (error) => {
        toast({
          title: "Unable to disconnect account",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<"All" | AccountPlatform>("All");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<OAuthPlatform | null>(null);
  const [manualForm, setManualForm] = useState({
    platform: "youtube" as AccountPlatform,
    accountName: "",
    accessToken: "",
    refreshToken: "",
    tokenExpiry: "",
    metadata: "",
  });

  const accounts = accountsQuery.data?.data ?? [];
  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const handle = getAccountHandle(account);
    const matchesSearch = account.accountName.toLowerCase().includes(searchQuery.toLowerCase())
      || handle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = filterPlatform === "All" || account.platform === filterPlatform;

    return matchesSearch && matchesPlatform;
  }), [accounts, searchQuery, filterPlatform]);

  const connectedCount = accounts.filter((account) => getAccountStatus(account) === "connected").length;
  const expiredCount = accounts.length - connectedCount;
  const platformCount = new Set(accounts.map((account) => account.platform)).size;
  const deletingId = deleteAccountMutation.variables?.id;

  const handleDelete = (id: string) => {
    deleteAccountMutation.mutate({ id });
  };

  const handleOAuthConnect = async (platform: OAuthPlatform) => {
    setConnectingPlatform(platform);

    try {
      const url = await getOAuthConnectUrl(platform);
      window.location.assign(url);
    } catch (error) {
      toast({
        title: "Connection unavailable",
        description: getErrorMessage(error),
        variant: "destructive",
      });
      setConnectingPlatform(null);
    }
  };

  const handleManualConnect = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    let metadata: Record<string, unknown> = {};

    if (manualForm.metadata.trim()) {
      try {
        metadata = JSON.parse(manualForm.metadata) as Record<string, unknown>;
      } catch {
        toast({
          title: "Invalid metadata",
          description: "Metadata must be valid JSON.",
          variant: "destructive",
        });
        return;
      }
    }

    createAccountMutation.mutate({
      data: {
        platform: manualForm.platform,
        accountName: manualForm.accountName,
        accessToken: manualForm.accessToken,
        refreshToken: manualForm.refreshToken.trim() || null,
        tokenExpiry: manualForm.tokenExpiry
          ? new Date(manualForm.tokenExpiry).toISOString()
          : null,
        metadata,
      },
    });
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-primary/10 flex items-center justify-center border border-blue-500/10">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="page-title mb-0">Account Management</h1>
          </div>
          <p className="page-subtitle ml-[52px]">Connect and manage social media accounts across all platforms.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 ml-[52px] md:ml-0">
          <Plus className="w-4 h-4" /> Connect Account
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Accounts", value: accounts.length, sub: "Loaded from API", icon: Users, color: "text-primary", gradient: "from-primary/20 to-primary/5" },
          { label: "Platforms", value: platformCount, sub: "Connected networks", icon: Database, color: "text-accent", gradient: "from-accent/20 to-accent/5" },
          { label: "Connected", value: connectedCount, sub: "Tokens active", icon: CheckCircle2, color: "text-emerald-400", gradient: "from-emerald-500/20 to-emerald-500/5", subColor: "text-emerald-400" },
          { label: "Needs Attention", value: expiredCount, sub: "Expired tokens", icon: ShieldAlert, color: "text-amber-400", gradient: "from-amber-500/20 to-amber-500/5", subColor: "text-amber-400" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-4">
            <div className="flex justify-between items-start mb-3">
              <p className="text-[11px] text-muted-foreground/50 font-medium">{card.label}</p>
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center border border-white/[0.04]`}>
                <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
              </div>
            </div>
            <h3 className="text-2xl font-display font-extrabold text-white">{accountsQuery.isLoading ? "..." : card.value}</h3>
            <p className={`text-[10px] mt-1 ${card.subColor || "text-muted-foreground/40"}`}>{card.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between glass-card p-2.5 rounded-2xl">
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(["All", "instagram", "tiktok", "youtube", "snapchat", "facebook"] as const).map((platform) => (
            <button
              key={platform}
              onClick={() => setFilterPlatform(platform)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
                filterPlatform === platform
                  ? "bg-primary text-white"
                  : "bg-white/[0.03] text-muted-foreground/60 hover:bg-white/[0.06] hover:text-white/70",
              )}
              style={filterPlatform === platform ? { boxShadow: "0 0 12px rgba(124, 58, 237, 0.3)" } : undefined}
            >
              {platform === "All" ? "All" : platformLabels[platform]}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search accounts..."
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg py-1.5 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-primary/30 transition-all"
          />
        </div>
      </div>

      {accountsQuery.isLoading && <LoadingGrid />}

      {accountsQuery.isError && (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/15 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-red-400" />
          </div>
          <p className="text-white/70 font-medium text-sm">Unable to load accounts</p>
          <p className="text-muted-foreground/40 text-xs mt-1">{getErrorMessage(accountsQuery.error)}</p>
          <button
            onClick={() => accountsQuery.refetch()}
            className="btn-secondary inline-flex items-center gap-2 mt-5"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {!accountsQuery.isLoading && !accountsQuery.isError && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
        >
          <AnimatePresence>
            {filteredAccounts.map((account) => {
              const platform = platformConfig[account.platform];
              const statusKey = getAccountStatus(account);
              const status = statusConfig[statusKey];
              const StatusIcon = status.icon;
              const isDeleting = deleteAccountMutation.isPending && deletingId === account.id;
              const handle = getAccountHandle(account);

              return (
                <motion.div
                  key={account.id}
                  variants={itemVariants}
                  layout
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "glass-card p-5 group hover:-translate-y-0.5 transition-all duration-300 cursor-pointer",
                    selectedAccount === account.id && "ring-1 ring-primary/30",
                  )}
                  style={selectedAccount === account.id ? { boxShadow: "0 0 20px rgba(124, 58, 237, 0.1)" } : undefined}
                  onClick={() => setSelectedAccount(selectedAccount === account.id ? null : account.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 bg-gradient-to-br",
                        platform.gradient,
                      )} style={{ color: "white" }}>
                        {getInitials(account.accountName)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white font-bold text-[13px] truncate">{account.accountName}</h3>
                        <p className="text-[11px] text-muted-foreground/40 truncate">{handle}</p>
                      </div>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        toast({
                          title: account.accountName,
                          description: "Expanded account actions are available below.",
                        });
                      }}
                      className="text-muted-foreground/30 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-all cursor-pointer p-1"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold border", platform.bg, platform.color, platform.border)}>
                      {platformLabels[account.platform]}
                    </span>
                    <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold border", status.bg, status.color)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", status.dot, isDeleting && "animate-pulse")} />
                      {isDeleting ? "Disconnecting..." : status.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <p className="text-sm font-display font-extrabold text-white truncate">{account.id.slice(0, 8)}</p>
                      <p className="text-[9px] text-muted-foreground/40">Account ID</p>
                    </div>
                    <div>
                      <p className="text-sm font-display font-extrabold text-white">{formatDate(account.createdAt)}</p>
                      <p className="text-[9px] text-muted-foreground/40">Created</p>
                    </div>
                    <div>
                      <p className="text-sm font-display font-extrabold text-white">{formatDate(account.tokenExpiry)}</p>
                      <p className="text-[9px] text-muted-foreground/40">Token</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                      <Clock className="w-3 h-3" />
                      <span>Created {formatDate(account.createdAt)}</span>
                    </div>
                    <span className={cn("flex items-center gap-1 text-[10px] font-bold", status.color)}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </div>

                  <AnimatePresence>
                    {selectedAccount === account.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex gap-2 mt-4 pt-4 border-t border-white/[0.04]">
                          <button
                            onClick={(event) => { event.stopPropagation(); accountsQuery.refetch(); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] rounded-lg text-[10px] text-white/70 font-medium transition-colors cursor-pointer"
                          >
                            <RefreshCcw className={cn("w-3 h-3", accountsQuery.isFetching && "animate-spin")} /> Refresh
                          </button>
                          <button
                            onClick={(event) => { event.stopPropagation(); handleDelete(account.id); }}
                            disabled={isDeleting}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 rounded-lg text-[10px] text-red-400 font-medium transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <Trash2 className="w-3 h-3" /> Disconnect
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/0 to-primary/0 group-hover:from-primary/[0.02] group-hover:to-transparent pointer-events-none transition-all duration-500 rounded-[inherit]" />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {!accountsQuery.isLoading && !accountsQuery.isError && filteredAccounts.length === 0 && (
        <div className="py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <Users className="w-7 h-7 text-muted-foreground/20" />
          </div>
          <p className="text-white/50 font-medium text-sm">No accounts found</p>
          <p className="text-muted-foreground/30 text-xs mt-1">Try adjusting your search or filter.</p>
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[92vh] overflow-y-auto glass-card p-6 z-50"
              style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center border border-primary/10">
                    <UserPlus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-white">Connect Account</h3>
                    <p className="text-xs text-muted-foreground/50">Use OAuth or add token details manually.</p>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground/50 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {oauthOptions.map((option) => {
                  const isConnecting = connectingPlatform === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleOAuthConnect(option.id)}
                      disabled={Boolean(connectingPlatform)}
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] p-3 text-left transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white/85">{option.label}</p>
                          <p className="text-xs text-muted-foreground/45 mt-0.5">{option.description}</p>
                        </div>
                        {isConnecting ? (
                          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                        ) : (
                          <ExternalLink className="w-4 h-4 text-muted-foreground/45 shrink-0" />
                        )}
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        {option.platforms.map((platform) => (
                          <span key={platform} className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold border", platformConfig[platform].bg, platformConfig[platform].color, platformConfig[platform].border)}>
                            {platformLabels[platform]}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/35">Manual</span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>

              <form onSubmit={handleManualConnect} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground/50">Platform</span>
                    <select
                      value={manualForm.platform}
                      onChange={(event) => setManualForm((current) => ({ ...current, platform: event.target.value as AccountPlatform }))}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-primary/30"
                    >
                      {manualPlatformOptions.map((platform) => (
                        <option key={platform} value={platform}>{platformLabels[platform]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground/50">Token Expiry</span>
                    <input
                      type="datetime-local"
                      value={manualForm.tokenExpiry}
                      onChange={(event) => setManualForm((current) => ({ ...current, tokenExpiry: event.target.value }))}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-primary/30"
                    />
                  </label>
                </div>
                <label className="space-y-1.5 block">
                  <span className="text-[10px] font-medium text-muted-foreground/50">Account Name</span>
                  <input
                    type="text"
                    required
                    value={manualForm.accountName}
                    onChange={(event) => setManualForm((current) => ({ ...current, accountName: event.target.value }))}
                    placeholder="BVIRAL YouTube"
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-primary/30"
                  />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-[10px] font-medium text-muted-foreground/50">Access Token</span>
                  <input
                    type="password"
                    required
                    value={manualForm.accessToken}
                    onChange={(event) => setManualForm((current) => ({ ...current, accessToken: event.target.value }))}
                    placeholder="Paste access token"
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-primary/30"
                  />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-[10px] font-medium text-muted-foreground/50">Refresh Token</span>
                  <input
                    type="password"
                    value={manualForm.refreshToken}
                    onChange={(event) => setManualForm((current) => ({ ...current, refreshToken: event.target.value }))}
                    placeholder="Optional"
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-primary/30"
                  />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-[10px] font-medium text-muted-foreground/50">Metadata JSON</span>
                  <textarea
                    value={manualForm.metadata}
                    onChange={(event) => setManualForm((current) => ({ ...current, metadata: event.target.value }))}
                    placeholder='{"channelId":"..."}'
                    rows={3}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-primary/30 resize-none"
                  />
                </label>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="flex items-start gap-3">
                    <KeyRound className="w-4 h-4 mt-0.5 text-primary" />
                    <p className="text-xs text-muted-foreground/45">
                      Manual accounts are saved through the API and can coexist with OAuth-connected accounts.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Close</button>
                  <button
                    type="submit"
                    disabled={createAccountMutation.isPending}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {createAccountMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Add Account
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
