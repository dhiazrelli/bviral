import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSchedulingData } from '@/hooks/use-mock-data';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  UploadCloud,
  Play,
  Calendar as CalendarIcon,
  Filter,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Sparkles,
  BarChart3,
} from 'lucide-react';

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function MiniCalendar() {
  const today = new Date(2026, 2, 23);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const scheduledDays = new Set([3, 5, 8, 12, 15, 17, 19, 22, 23, 25, 27, 29]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

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
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground/50 hover:text-white transition-colors cursor-pointer">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground/50 hover:text-white transition-colors cursor-pointer">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="text-center text-[10px] text-muted-foreground/40 pb-1.5 font-semibold">{day}</div>
        ))}
        {cells.map((day, i) => {
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const hasPost = day !== null && scheduledDays.has(day);
          return (
            <div
              key={i}
              className={`relative aspect-square flex items-center justify-center text-[11px] rounded-lg cursor-pointer transition-all duration-200 ${
                day === null ? '' :
                isToday ? 'bg-primary text-white font-bold' :
                hasPost ? 'bg-white/[0.04] text-white/80 hover:bg-primary/15 border border-primary/15' :
                'text-muted-foreground/50 hover:bg-white/[0.04] hover:text-white/60'
              }`}
              style={isToday ? { boxShadow: '0 0 15px rgba(124, 58, 237, 0.5)' } : undefined}
            >
              {day}
              {hasPost && !isToday ? (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" style={{ boxShadow: '0 0 4px rgba(124, 58, 237, 0.5)' }} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const platformColors: Record<string, string> = {
  Instagram: 'bg-pink-500/10 text-pink-400 border-pink-500/15',
  TikTok: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/15',
  YouTube: 'bg-red-500/10 text-red-400 border-red-500/15',
  Snapchat: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/15',
  Facebook: 'bg-blue-500/10 text-blue-400 border-blue-500/15',
};

const statusConfig: Record<string, { color: string; dot: string }> = {
  Active: { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/15', dot: 'bg-emerald-400' },
  Paused: { color: 'text-amber-400 bg-amber-400/10 border-amber-400/15', dot: 'bg-amber-400' },
  Error: { color: 'text-red-400 bg-red-400/10 border-red-400/15', dot: 'bg-red-400' },
};

export default function Scheduling() {
  const { isLoading, accounts } = useSchedulingData();
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<number | null>(1);
  const [pipelineFilter, setPipelineFilter] = useState<'All' | 'Active' | 'Attention'>('All');
  const visibleAccounts = accounts.filter((account) => {
    if (pipelineFilter === 'Active') {
      return account.status === 'Active';
    }

    if (pipelineFilter === 'Attention') {
      return account.status !== 'Active';
    }

    return true;
  });
  const activeAccount = visibleAccounts.find((account) => account.id === selectedAccount)
    ?? accounts.find((account) => account.id === selectedAccount)
    ?? visibleAccounts[0]
    ?? accounts[0];
  const scheduledTime = activeAccount.platform === 'TikTok' ? 'Tomorrow, 18:10 EST' : 'Tomorrow, 14:30 EST';
  const previewCaption = `High-retention ${activeAccount.tag.toLowerCase()} edit queued for ${activeAccount.platform}. Hook is optimized for first-three-second retention and short-loop replays.`;
  const handleFilterToggle = () => {
    const nextFilter = pipelineFilter === 'All'
      ? 'Attention'
      : pipelineFilter === 'Attention'
        ? 'Active'
        : 'All';

    setPipelineFilter(nextFilter);
    toast({
      title: `Pipeline filter: ${nextFilter}`,
      description: nextFilter === 'All'
        ? 'Showing every publishing lane.'
        : nextFilter === 'Attention'
          ? 'Showing paused and error states.'
          : 'Showing only active lanes.',
    });
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary animate-spin rounded-full border-t-transparent"></div>
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
          <p className="page-subtitle ml-[52px]">Manage your 100+ accounts publishing pipeline.</p>
        </div>
        <div className="flex gap-2 ml-[52px] sm:ml-0">
          <button
            onClick={() => toast({
              title: 'Bulk import ready',
              description: 'CSV ingest flow is queued for operator upload.',
            })}
            className="btn-secondary flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" /> Bulk CSV
          </button>
          <button
            onClick={() => toast({
              title: 'Composer opened',
              description: `Starting a new post for ${activeAccount.name}.`,
            })}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Post
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.75fr)_minmax(360px,1fr)] gap-4 flex-1 min-h-0">
        <div className="flex flex-col gap-4 h-full min-w-0">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card flex flex-col flex-shrink-0 max-h-[50%]"
          >
            <div className="p-4 border-b border-white/[0.04] flex justify-between items-center sticky top-0 bg-card/80 backdrop-blur-md z-10">
              <h2 className="font-display font-bold text-white text-sm">Active Pipelines</h2>
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
                    <th className="p-3 font-medium text-[11px] uppercase tracking-wider">Tag</th>
                    <th className="p-3 font-medium text-[11px] uppercase tracking-wider">Queued</th>
                    <th className="p-3 font-medium text-[11px] uppercase tracking-wider">Last Upload</th>
                    <th className="p-3 font-medium text-[11px] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {visibleAccounts.map((account) => {
                    const status = statusConfig[account.status] || statusConfig.Active;
                    return (
                      <tr
                        key={account.id}
                        onClick={() => setSelectedAccount(account.id)}
                        className={`hover:bg-white/[0.02] cursor-pointer transition-colors ${selectedAccount === account.id ? 'bg-primary/[0.04] border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'}`}
                      >
                        <td className="p-3 pl-5 font-semibold text-white/90">{account.name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${platformColors[account.platform]}`}>
                            {account.platform}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-white/[0.04] text-muted-foreground/60 border border-white/[0.06] font-medium">
                            {account.tag}
                          </span>
                        </td>
                        <td className="p-3 text-white/80 font-mono text-xs">{account.scheduled}</td>
                        <td className="p-3 text-muted-foreground/50 text-xs">{account.lastUpload}</td>
                        <td className="p-3">
                          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border w-fit ${status.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {account.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <MiniCalendar />
          </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card p-5 flex flex-col h-[260px]"
        >
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display font-bold text-white text-sm flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/10">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                </div>
                Next 24 Hours
              </h2>
              <div className="flex gap-1 text-[10px] text-muted-foreground/40 font-mono">
                {['00:00', '06:00', '12:00', '18:00'].map((time) => (
                  <span key={time} className="px-2 py-1 bg-white/[0.03] rounded border border-white/[0.04]">{time}</span>
                ))}
              </div>
            </div>

            <div className="relative flex-1 bg-black/20 rounded-xl border border-white/[0.04] p-4 overflow-hidden">
              <div className="absolute inset-0 flex justify-between px-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-full w-px bg-white/[0.03]"></div>
                ))}
              </div>

              <div className="relative h-full pt-2">
                <div className="absolute top-2 left-[10%] w-[15%] h-11 bg-primary/15 border border-primary/30 rounded-lg p-2 flex flex-col justify-center cursor-move hover:border-primary/60 transition-colors backdrop-blur-md group">
                  <div className="w-1/2 h-1 bg-primary/40 rounded mb-1 group-hover:bg-primary/60 transition-colors"></div>
                  <div className="w-3/4 h-1 bg-primary/20 rounded group-hover:bg-primary/40 transition-colors"></div>
                </div>

                <div className="absolute top-14 left-[35%] w-[20%] h-11 bg-accent/15 border border-accent/30 rounded-lg p-2 flex flex-col justify-center cursor-move hover:border-accent/60 transition-colors backdrop-blur-md group">
                  <div className="w-1/2 h-1 bg-accent/40 rounded mb-1 group-hover:bg-accent/60 transition-colors"></div>
                  <div className="w-3/4 h-1 bg-accent/20 rounded group-hover:bg-accent/40 transition-colors"></div>
                </div>

                <div className="absolute top-[104px] left-[65%] w-[12%] h-11 bg-pink-500/15 border border-pink-500/30 rounded-lg p-2 flex flex-col justify-center cursor-move hover:border-pink-500/60 transition-colors backdrop-blur-md group">
                  <div className="w-1/2 h-1 bg-pink-500/40 rounded mb-1 group-hover:bg-pink-500/60 transition-colors"></div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="self-start min-w-0"
        >
          <div className="glass-card p-5 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7.5rem)] xl:overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="font-display font-bold text-white text-sm">Post Preview</h2>
                <p className="text-[11px] text-muted-foreground/50 mt-1">Compact operator view</p>
              </div>
              <button
                onClick={() => toast({
                  title: 'Preview actions',
                  description: `Review tools opened for ${activeAccount.name}.`,
                })}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground/50 hover:text-white transition-colors cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/40 font-bold">Queue</p>
                  <p className="mt-2 text-lg font-display font-bold text-white">{activeAccount.scheduled}</p>
                  <p className="text-[11px] text-muted-foreground/50">assets lined up</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/40 font-bold">Channel</p>
                  <p className="mt-2 text-lg font-display font-bold text-white">{activeAccount.platform}</p>
                  <p className="text-[11px] text-muted-foreground/50">{activeAccount.tag} lane</p>
                </div>
              </div>

              <div
                className="border-[3px] border-white/[0.08] rounded-[2.5rem] bg-black relative overflow-hidden mx-auto w-full max-w-[290px] aspect-[10/17]"
                style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 25px 50px rgba(0,0,0,0.5)' }}
              >
                <div className="absolute top-3 left-0 right-0 flex justify-center z-20">
                  <div className="w-[90px] h-[22px] bg-black rounded-full border border-white/[0.04]"></div>
                </div>

                <div
                  className="absolute inset-0 group cursor-pointer"
                  onClick={() => toast({
                    title: 'Preview playback',
                    description: `${activeAccount.platform} post preview opened.`,
                  })}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/60 via-purple-900/40 to-slate-900/60"></div>
                  <div className="absolute inset-0 opacity-30">
                    <div className="absolute w-40 h-40 rounded-full bg-primary/40 blur-3xl top-1/4 left-1/4 animate-float" />
                    <div className="absolute w-32 h-32 rounded-full bg-accent/30 blur-3xl bottom-1/4 right-1/4 animate-float" style={{ animationDelay: '3s' }} />
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300 border border-white/10">
                      <Play className="w-6 h-6 text-white ml-1" />
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {activeAccount.name.charAt(1) || 'U'}
                      </div>
                      <span className="font-bold text-white text-[13px]">{activeAccount.name}</span>
                    </div>
                    <p className="text-white/80 text-xs leading-relaxed line-clamp-2 mb-2">
                      {previewCaption}
                    </p>
                    <p className="text-primary text-[11px] font-bold">#{activeAccount.tag.toLowerCase()} #viral #fyp</p>
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
                  <span className="text-white/80 font-medium text-right">{scheduledTime}</span>
                </div>
                <div className="flex justify-between text-xs gap-3">
                  <span className="text-muted-foreground/50">Platforms:</span>
                  <div className="flex gap-1.5">
                    <span className={`px-2 h-5 rounded border flex items-center justify-center text-[9px] font-bold ${platformColors[activeAccount.platform]}`}>
                      {activeAccount.platform.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="px-2 h-5 rounded bg-white/[0.04] text-white/60 border border-white/[0.08] flex items-center justify-center text-[9px] font-bold">
                      ALT
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-xs gap-3">
                  <span className="text-muted-foreground/50">Est. impact:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                    <BarChart3 className="w-3 h-3" />
                    +18% retention projection
                  </span>
                </div>
                <button
                  onClick={() => toast({
                    title: 'Edit post details',
                    description: `Metadata editor loaded for ${activeAccount.name}.`,
                  })}
                  className="w-full py-2.5 mt-2 border border-white/[0.08] hover:bg-white/[0.04] hover:border-white/[0.12] rounded-xl text-white/80 text-xs font-semibold transition-all cursor-pointer"
                >
                  Edit Post Details
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
