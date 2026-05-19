import { useState } from "react";
import { Building2, CheckCircle2, Clock, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListBviralAccountsQueryKey,
  useCreateBviralAccount,
  useListBviralAccounts,
  type AccountPlatform,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Platform = AccountPlatform;

const PLATFORMS: Platform[] = ["facebook", "instagram", "tiktok", "youtube", "snapchat"];

const platformLabels: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

function ConnectDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [accountName, setAccountName] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateBviralAccount({
    mutation: {
      onSuccess: () => {
        setOpen(false);
        setAccountName("");
        setAccessToken("");
        setError(null);
        onSuccess();
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to create account");
      },
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Connect account
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-background/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle>Connect BViral Company Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
              <SelectTrigger className="border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>{platformLabels[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Account name</Label>
            <Input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. BViral Official"
              className="border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label>Access token</Label>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste access token"
              className="border-white/10"
            />
          </div>
          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
          <Button
            onClick={() => mutation.mutate({ data: { platform, accountName, accessToken } })}
            disabled={!accountName.trim() || !accessToken.trim() || mutation.isPending}
            className="w-full"
          >
            {mutation.isPending ? "Connecting…" : "Connect"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BviralAccounts() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useListBviralAccounts();

  const accounts = data?.data ?? [];

  const handleSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: getListBviralAccountsQueryKey() });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-white">BViral Company Accounts</h2>
          <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-bold text-white/50">
            {accounts.length}
          </span>
        </div>
        <ConnectDialog onSuccess={handleSuccess} />
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="glass-card flex h-48 flex-col items-center justify-center gap-3 rounded-2xl">
          <Building2 className="h-8 w-8 text-white/20" />
          <p className="text-sm text-white/40">No company accounts connected yet.</p>
          <ConnectDialog onSuccess={handleSuccess} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="glass-card flex flex-col gap-4 rounded-2xl p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-white">{account.accountName}</p>
                  <p className="text-[12px] text-white/45">{platformLabels[account.platform]}</p>
                </div>
                <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  Company
                </span>
              </div>
              <div>
                {account.tokenExpiry ? (
                  <div className="flex items-center gap-1.5 text-[12px] text-white/45">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Expires {new Date(account.tokenExpiry).toLocaleDateString()}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[12px] text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Token active</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
