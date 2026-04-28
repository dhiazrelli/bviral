import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlertsData } from '@/hooks/use-mock-data';
import { 
  BellRing, AlertOctagon, AlertCircle, Info, Search, ShieldAlert,
  ArrowRight, ArrowUpDown, Check, type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriorityConfigEntry {
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  glow: string;
}

const priorityConfig: Record<string, PriorityConfigEntry> = {
  Critical: { icon: AlertOctagon, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', glow: 'rgba(239, 68, 68, 0.15)' },
  High: { icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', glow: 'rgba(251, 146, 60, 0.1)' },
  Medium: { icon: ShieldAlert, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', glow: 'rgba(250, 204, 21, 0.08)' },
  Low: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', glow: 'rgba(96, 165, 250, 0.08)' },
};

const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

type SortMode = 'priority' | 'time';

export default function Alerts() {
  const { isLoading, alerts } = useAlertsData();
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState<SortMode>('priority');
  const [resolvedIds, setResolvedIds] = useState<Set<number>>(new Set());

  if (isLoading) return <div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary animate-spin rounded-full border-t-transparent"></div></div>;

  const filtered = filter === 'All' ? alerts : alerts.filter(a => a.priority === filter);
  const filteredAlerts = [...filtered]
    .filter(a => !resolvedIds.has(a.id))
    .sort((a, b) =>
      sort === 'priority'
        ? (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
        : a.id - b.id
    );

  const handleResolve = (id: number) => {
    setResolvedIds(prev => new Set([...prev, id]));
  };

  const handleMarkAllRead = () => {
    setResolvedIds(new Set(alerts.map(a => a.id)));
  };

  const unresolvedCount = alerts.filter(a => !resolvedIds.has(a.id)).length;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      {/* Header with gradient banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-card p-5 bg-gradient-to-r from-primary/[0.06] to-transparent">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-primary/15 rounded-xl flex items-center justify-center border border-primary/15"
            style={{ boxShadow: '0 0 20px rgba(124, 58, 237, 0.15)' }}>
            <BellRing className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-white">System Alerts</h1>
            <p className="text-muted-foreground/50 text-xs mt-0.5">
              {unresolvedCount > 0 ? `You have ${unresolvedCount} unread notifications requiring attention.` : 'All caught up! No pending alerts.'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleMarkAllRead}
          disabled={unresolvedCount === 0}
          className="btn-secondary flex items-center gap-2 text-xs disabled:opacity-30"
        >
          <Check className="w-3.5 h-3.5" />
          Mark All Read
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between glass-card p-2.5 rounded-2xl">
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['All', 'Critical', 'High', 'Medium', 'Low'].map(p => (
            <button 
              key={p}
              onClick={() => setFilter(p)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
                filter === p 
                  ? "bg-primary text-white" 
                  : "bg-white/[0.03] text-muted-foreground/60 hover:bg-white/[0.06] hover:text-white/70"
              )}
              style={filter === p ? { boxShadow: '0 0 12px rgba(124, 58, 237, 0.3)' } : undefined}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSort(s => s === 'priority' ? 'time' : 'priority')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-muted-foreground/60 hover:bg-white/[0.06] hover:text-white/70 transition-colors whitespace-nowrap cursor-pointer"
          >
            <ArrowUpDown className="w-3 h-3" />
            Sort: {sort === 'priority' ? 'Priority' : 'Time'}
          </button>
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
            <input 
              type="text" 
              placeholder="Search alerts..." 
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg py-1.5 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-primary/30"
            />
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredAlerts.map((alert, i) => {
            const config = priorityConfig[alert.priority] || priorityConfig.Low;
            const Icon = config.icon;
            
            return (
              <motion.div 
                key={alert.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50, height: 0, marginBottom: 0, padding: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className={cn(
                  "glass-card p-5 border-l-[3px] group hover:bg-white/[0.01] transition-all relative overflow-hidden",
                  config.color.replace('text-', 'border-')
                )}
              >
                {/* Background glow for critical */}
                {alert.priority === 'Critical' && (
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] pointer-events-none" style={{ backgroundColor: config.glow }} />
                )}

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center relative z-10">
                  <div className={cn("p-2.5 rounded-xl border shrink-0", config.bg, config.border)}>
                    <Icon className={cn("w-5 h-5", config.color)} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="text-[15px] font-bold text-white truncate">{alert.title}</h3>
                      <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-white/[0.04] text-white/40 border border-white/[0.06] shrink-0">
                        {alert.type}
                      </span>
                    </div>
                    <p className="text-muted-foreground/50 text-xs leading-relaxed">
                      {alert.desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 sm:flex-col sm:items-end shrink-0 w-full sm:w-auto justify-between sm:justify-center">
                    <div className="flex flex-col items-start sm:items-end">
                      <span className="text-[10px] font-semibold text-primary/70 mb-0.5">{alert.platform}</span>
                      <span className="text-[10px] text-muted-foreground/40">{alert.time}</span>
                    </div>
                    <button 
                      onClick={() => handleResolve(alert.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-white/70 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-3.5 py-2 rounded-lg transition-all group-hover:border-primary/30 group-hover:text-primary cursor-pointer"
                    >
                      Resolve <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {filteredAlerts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-16 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-white/60 font-medium text-sm">All clear!</p>
            <p className="text-muted-foreground/40 text-xs mt-1">No alerts matching this criteria.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
