import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Search, MoreHorizontal, ShieldCheck,
  ShieldAlert, Shield, BarChart3,
  RefreshCcw, Trash2, ExternalLink, CheckCircle2,
  Clock, TrendingUp, Eye, X, UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Account {
  id: number;
  name: string;
  handle: string;
  platform: string;
  followers: string;
  engagement: string;
  status: 'connected' | 'expired' | 'rate-limited';
  lastSync: string;
  postsThisWeek: number;
  avatar: string;
  growth: string;
  isPositive: boolean;
}

const initialAccounts: Account[] = [
  { id: 1, name: "Luxury Life", handle: "@LuxuryLife", platform: "Instagram", followers: "2.4M", engagement: "8.2%", status: "connected", lastSync: "2 mins ago", postsThisWeek: 14, avatar: "LL", growth: "+12.4K", isPositive: true },
  { id: 2, name: "Tech Gadgets", handle: "@TechGadgets", platform: "TikTok", followers: "1.8M", engagement: "14.5%", status: "connected", lastSync: "5 mins ago", postsThisWeek: 21, avatar: "TG", growth: "+28.1K", isPositive: true },
  { id: 3, name: "Crypto Insights", handle: "CryptoInsights", platform: "YouTube", followers: "890K", engagement: "6.1%", status: "expired", lastSync: "3 days ago", postsThisWeek: 0, avatar: "CI", growth: "-1.2K", isPositive: false },
  { id: 4, name: "Daily Memes", handle: "@DailyMemes", platform: "Snapchat", followers: "3.1M", engagement: "11.8%", status: "connected", lastSync: "15 mins ago", postsThisWeek: 42, avatar: "DM", growth: "+45.2K", isPositive: true },
  { id: 5, name: "Fitness Journey", handle: "FitnessJourney", platform: "Facebook", followers: "450K", engagement: "4.3%", status: "rate-limited", lastSync: "1 hour ago", postsThisWeek: 3, avatar: "FJ", growth: "+2.1K", isPositive: true },
  { id: 6, name: "Travel Wonders", handle: "@TravelWonders", platform: "Instagram", followers: "1.2M", engagement: "9.7%", status: "connected", lastSync: "10 mins ago", postsThisWeek: 18, avatar: "TW", growth: "+8.9K", isPositive: true },
  { id: 7, name: "Food Porn", handle: "@FoodPorn", platform: "TikTok", followers: "4.7M", engagement: "16.2%", status: "connected", lastSync: "1 min ago", postsThisWeek: 35, avatar: "FP", growth: "+62.3K", isPositive: true },
  { id: 8, name: "Music Vibes", handle: "@MusicVibes", platform: "Instagram", followers: "780K", engagement: "7.4%", status: "connected", lastSync: "30 mins ago", postsThisWeek: 9, avatar: "MV", growth: "+5.6K", isPositive: true },
];

const platformConfig: Record<string, { color: string; bg: string; border: string; gradient: string }> = {
  Instagram: { color: 'text-pink-400', bg: 'bg-pink-500/8', border: 'border-pink-500/15', gradient: 'from-pink-500 to-purple-500' },
  TikTok: { color: 'text-cyan-400', bg: 'bg-cyan-500/8', border: 'border-cyan-500/15', gradient: 'from-cyan-400 to-blue-500' },
  YouTube: { color: 'text-red-400', bg: 'bg-red-500/8', border: 'border-red-500/15', gradient: 'from-red-500 to-red-600' },
  Snapchat: { color: 'text-yellow-400', bg: 'bg-yellow-500/8', border: 'border-yellow-500/15', gradient: 'from-yellow-400 to-amber-500' },
  Facebook: { color: 'text-blue-400', bg: 'bg-blue-500/8', border: 'border-blue-500/15', gradient: 'from-blue-500 to-indigo-500' },
};

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; dot: string }> = {
  connected: { label: 'Connected', icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/15', dot: 'bg-emerald-400' },
  expired: { label: 'Token Expired', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/15', dot: 'bg-red-400' },
  'rate-limited': { label: 'Rate Limited', icon: Shield, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/15', dot: 'bg-amber-400' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 400, damping: 25 } }
};

export default function Accounts() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('All');
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());

  const filteredAccounts = useMemo(() => accounts.filter(acc => {
    const matchesSearch = acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          acc.handle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = filterPlatform === 'All' || acc.platform === filterPlatform;
    return matchesSearch && matchesPlatform;
  }), [accounts, searchQuery, filterPlatform]);

  const totalFollowers = "15.2M";
  const connectedCount = accounts.filter(a => a.status === 'connected').length;
  const errorCount = accounts.filter(a => a.status !== 'connected').length;

  const handleResync = (id: number) => {
    setSyncingIds(prev => new Set([...prev, id]));
    setTimeout(() => {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, lastSync: 'Just now', status: 'connected' as const } : a));
    }, 2000);
  };

  const handleDelete = (id: number) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
    if (selectedAccount === id) setSelectedAccount(null);
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Accounts', value: accounts.length, sub: 'Across 5 platforms', icon: Users, color: 'text-primary', gradient: 'from-primary/20 to-primary/5' },
          { label: 'Total Reach', value: totalFollowers, sub: '+164K this month', icon: Eye, color: 'text-accent', gradient: 'from-accent/20 to-accent/5', subColor: 'text-emerald-400' },
          { label: 'Connected', value: connectedCount, sub: 'All syncing normally', icon: CheckCircle2, color: 'text-emerald-400', gradient: 'from-emerald-500/20 to-emerald-500/5', subColor: 'text-emerald-400' },
          { label: 'Needs Attention', value: errorCount, sub: 'Requires re-auth', icon: ShieldAlert, color: 'text-amber-400', gradient: 'from-amber-500/20 to-amber-500/5', subColor: 'text-amber-400' },
        ].map((card, i) => (
          <motion.div key={i} initial={{opacity:0, y:16}} animate={{opacity:1, y:0}} transition={{delay: i * 0.05}} className="glass-card p-4">
            <div className="flex justify-between items-start mb-3">
              <p className="text-[11px] text-muted-foreground/50 font-medium">{card.label}</p>
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center border border-white/[0.04]`}>
                <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
              </div>
            </div>
            <h3 className="text-2xl font-display font-extrabold text-white">{card.value}</h3>
            <p className={`text-[10px] mt-1 ${card.subColor || 'text-muted-foreground/40'}`}>{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between glass-card p-2.5 rounded-2xl">
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['All', 'Instagram', 'TikTok', 'YouTube', 'Snapchat', 'Facebook'].map(p => (
            <button
              key={p}
              onClick={() => setFilterPlatform(p)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
                filterPlatform === p
                  ? "bg-primary text-white"
                  : "bg-white/[0.03] text-muted-foreground/60 hover:bg-white/[0.06] hover:text-white/70"
              )}
              style={filterPlatform === p ? { boxShadow: '0 0 12px rgba(124, 58, 237, 0.3)' } : undefined}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts..."
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg py-1.5 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-primary/30 transition-all"
          />
        </div>
      </div>

      {/* Accounts Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
      >
        <AnimatePresence>
          {filteredAccounts.map((account) => {
            const platform = platformConfig[account.platform];
            const status = statusConfig[account.status];
            const StatusIcon = status.icon;
            const isSyncing = syncingIds.has(account.id);

            return (
              <motion.div
                key={account.id}
                variants={itemVariants}
                layout
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "glass-card p-5 group hover:-translate-y-0.5 transition-all duration-300 cursor-pointer",
                  selectedAccount === account.id && "ring-1 ring-primary/30"
                )}
                style={selectedAccount === account.id ? { boxShadow: '0 0 20px rgba(124, 58, 237, 0.1)' } : undefined}
                onClick={() => setSelectedAccount(selectedAccount === account.id ? null : account.id)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 bg-gradient-to-br",
                      platform.gradient
                    )} style={{ color: 'white' }}>
                      {account.avatar}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-[13px]">{account.name}</h3>
                      <p className="text-[11px] text-muted-foreground/40">{account.handle}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toast({
                        title: account.name,
                        description: 'Expanded account actions are available below.',
                      });
                    }}
                    className="text-muted-foreground/30 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-all cursor-pointer p-1"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Platform + Status */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold border", platform.bg, platform.color, platform.border)}>
                    {account.platform}
                  </span>
                  <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold border", status.bg, status.color)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", status.dot, isSyncing && "animate-pulse")} />
                    {isSyncing ? 'Syncing...' : status.label}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <p className="text-base font-display font-extrabold text-white">{account.followers}</p>
                    <p className="text-[9px] text-muted-foreground/40">Followers</p>
                  </div>
                  <div>
                    <p className="text-base font-display font-extrabold text-white">{account.engagement}</p>
                    <p className="text-[9px] text-muted-foreground/40">Eng. Rate</p>
                  </div>
                  <div>
                    <p className="text-base font-display font-extrabold text-white">{account.postsThisWeek}</p>
                    <p className="text-[9px] text-muted-foreground/40">Posts/Week</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                    <Clock className="w-3 h-3" />
                    <span>{account.lastSync}</span>
                  </div>
                  <span className={cn("flex items-center gap-0.5 text-[10px] font-bold", account.isPositive ? "text-emerald-400" : "text-red-400")}>
                    <TrendingUp className={cn("w-3 h-3", !account.isPositive && "rotate-180")} />
                    {account.growth}
                  </span>
                </div>

                {/* Expanded Actions */}
                <AnimatePresence>
                  {selectedAccount === account.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-2 mt-4 pt-4 border-t border-white/[0.04]">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleResync(account.id); }}
                          disabled={isSyncing}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] rounded-lg text-[10px] text-white/70 font-medium transition-colors cursor-pointer disabled:opacity-40"
                        >
                          <RefreshCcw className={cn("w-3 h-3", isSyncing && "animate-spin")} /> {isSyncing ? 'Syncing...' : 'Re-sync'}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); window.open('#', '_blank'); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] rounded-lg text-[10px] text-white/70 font-medium transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" /> Open
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(account.id); }}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 rounded-lg text-[10px] text-red-400 font-medium transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Hover glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/0 to-primary/0 group-hover:from-primary/[0.02] group-hover:to-transparent pointer-events-none transition-all duration-500 rounded-[inherit]" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {filteredAccounts.length === 0 && (
        <div className="py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <Users className="w-7 h-7 text-muted-foreground/20" />
          </div>
          <p className="text-white/50 font-medium text-sm">No accounts found</p>
          <p className="text-muted-foreground/30 text-xs mt-1">Try adjusting your search or filter.</p>
        </div>
      )}

      {/* Add Account Modal */}
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md glass-card p-6 z-50"
              style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center border border-primary/10">
                    <UserPlus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-white">Connect Account</h3>
                    <p className="text-xs text-muted-foreground/50">Link a new social media account</p>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground/50 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Platform</label>
                  <select className="input-field appearance-none cursor-pointer">
                    <option>Instagram</option>
                    <option>TikTok</option>
                    <option>YouTube</option>
                    <option>Snapchat</option>
                    <option>Facebook</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Account Name</label>
                  <input type="text" placeholder="e.g. My Brand Page" className="input-field" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Handle</label>
                  <input type="text" placeholder="@youraccount" className="input-field" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={() => setShowAddModal(false)} className="btn-primary flex-1">Connect</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
