import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, Clock, ArrowUpRight, ArrowDownRight, Telescope, Play } from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend 
} from 'recharts';

const lineData = [
  { day: '01', ig: 400, tt: 240, yt: 240 },
  { day: '05', ig: 300, tt: 439, yt: 221 },
  { day: '10', ig: 200, tt: 980, yt: 229 },
  { day: '15', ig: 278, tt: 390, yt: 200 },
  { day: '20', ig: 189, tt: 480, yt: 218 },
  { day: '25', ig: 239, tt: 380, yt: 250 },
  { day: '30', ig: 349, tt: 430, yt: 210 },
];

const barData = [
  { name: 'Mon', views: 4000, likes: 2400 },
  { name: 'Tue', views: 3000, likes: 1398 },
  { name: 'Wed', views: 2000, likes: 9800 },
  { name: 'Thu', views: 2780, likes: 3908 },
  { name: 'Fri', views: 1890, likes: 4800 },
  { name: 'Sat', views: 2390, likes: 3800 },
  { name: 'Sun', views: 3490, likes: 4300 },
];

const topVideos = [
  { id: 1, title: "10 AI Tools You Need (2024)", views: "1.2M", engagement: "14.5%", platform: "TikTok" },
  { id: 2, title: "Day in the life of Software Engineer", views: "854K", engagement: "11.2%", platform: "Instagram" },
  { id: 3, title: "I tried the Pomodoro Technique", views: "650K", engagement: "18.9%", platform: "YouTube" },
  { id: 4, title: "Crypto Market Analysis Q3", views: "420K", engagement: "8.4%", platform: "TikTok" },
];

const platformComparisons = [
  { name: "Instagram", abbr: "IG", views: "9.2M", engagement: "10.8%", followers: "+42K", color: "text-pink-400", bg: "bg-pink-500/8 border-pink-500/15", barColor: "bg-pink-400", bar: 72 },
  { name: "TikTok", abbr: "TT", views: "11.4M", engagement: "14.2%", followers: "+98K", color: "text-cyan-400", bg: "bg-cyan-500/8 border-cyan-500/15", barColor: "bg-cyan-400", bar: 90 },
  { name: "YouTube", abbr: "YT", views: "3.1M", engagement: "8.4%", followers: "+12K", color: "text-red-400", bg: "bg-red-500/8 border-red-500/15", barColor: "bg-red-400", bar: 45 },
  { name: "Facebook", abbr: "FB", views: "1.4M", engagement: "6.1%", followers: "+5K", color: "text-blue-400", bg: "bg-blue-500/8 border-blue-500/15", barColor: "bg-blue-400", bar: 28 },
  { name: "Snapchat", abbr: "SC", views: "0.8M", engagement: "5.2%", followers: "+3K", color: "text-yellow-400", bg: "bg-yellow-500/8 border-yellow-500/15", barColor: "bg-yellow-400", bar: 18 },
];

const HEATMAP_HOURS = ['12a','3a','6a','9a','12p','3p','6p','9p'];
const HEATMAP_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const engagementHeatmap: number[][] = [
  [1,1,2,4,6,8,7,3],
  [1,1,3,5,7,9,8,4],
  [2,1,3,6,7,10,9,5],
  [1,1,2,5,8,9,8,4],
  [2,1,4,7,9,10,9,5],
  [3,2,5,8,9,7,6,3],
  [4,2,4,7,8,6,5,2],
];

const tooltipStyle = { 
  backgroundColor: 'rgba(10, 10, 18, 0.95)', 
  borderColor: 'rgba(255,255,255,0.06)', 
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
};

const platformBadge: Record<string, string> = {
  TikTok: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/15',
  Instagram: 'bg-pink-500/10 text-pink-400 border-pink-500/15',
  YouTube: 'bg-red-500/10 text-red-400 border-red-500/15',
};

export default function Analytics() {
  const [dateRange, setDateRange] = useState("Last 30 Days");

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-primary/10 flex items-center justify-center border border-amber-500/10">
              <Telescope className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="page-title mb-0">Advanced Analytics</h1>
          </div>
          <p className="page-subtitle ml-[52px]">Deep dive into cross-platform performance.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 glass-card p-1.5 rounded-xl ml-[52px] md:ml-0">
          <select className="bg-transparent text-xs text-white/60 px-2.5 py-1.5 focus:outline-none cursor-pointer rounded-lg hover:bg-white/[0.04]">
            <option className="bg-card">All Platforms</option>
            <option className="bg-card">Instagram</option>
            <option className="bg-card">TikTok</option>
          </select>
          <div className="w-px h-5 bg-white/[0.06] self-center" />
          <select className="bg-transparent text-xs text-white/60 px-2.5 py-1.5 focus:outline-none cursor-pointer rounded-lg hover:bg-white/[0.04]">
            <option className="bg-card">All Accounts</option>
            <option className="bg-card">@TechGadgets</option>
          </select>
          <div className="w-px h-5 bg-white/[0.06] self-center" />
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-transparent text-xs text-primary font-semibold px-2.5 py-1.5 focus:outline-none cursor-pointer rounded-lg hover:bg-white/[0.04]"
          >
            <option className="bg-card">Last 7 Days</option>
            <option className="bg-card">Last 30 Days</option>
            <option className="bg-card">This Year</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Cross-Platform Views', value: '24.8M', change: '+18.2%', positive: true, icon: BarChart3, color: 'from-primary/20 to-primary/5', iconColor: 'text-primary', borderColor: 'border-t-primary' },
          { label: 'Avg Engagement Rate', value: '12.4%', change: '+2.1%', positive: true, icon: TrendingUp, color: 'from-accent/20 to-accent/5', iconColor: 'text-accent', borderColor: 'border-t-accent' },
          { label: 'Net New Followers', value: '184K', change: '-4.5%', positive: false, icon: Users, color: 'from-pink-500/20 to-pink-500/5', iconColor: 'text-pink-400', borderColor: 'border-t-pink-500' },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{opacity:0, y:16}} animate={{opacity:1, y:0}} transition={{ delay: i * 0.08 }} className={`glass-card p-5 border-t-2 ${kpi.borderColor}`}>
            <div className="flex justify-between items-start mb-3">
              <p className="text-xs text-muted-foreground/50">{kpi.label}</p>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${kpi.color} flex items-center justify-center border border-white/[0.04]`}>
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.iconColor}`} />
              </div>
            </div>
            <h3 className="text-3xl font-display font-extrabold text-white mb-2 tracking-tight">{kpi.value}</h3>
            <p className={`text-[11px] flex items-center font-semibold ${kpi.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {kpi.positive ? <ArrowUpRight className="w-3 h-3 mr-0.5"/> : <ArrowDownRight className="w-3 h-3 mr-0.5"/>}
              {kpi.change} vs previous period
            </p>
          </motion.div>
        ))}
      </div>

      {/* Platform Comparison */}
      <motion.div initial={{opacity:0, y:16}} animate={{opacity:1, y:0}} transition={{delay:0.25}} className="glass-card p-5">
        <h3 className="font-display font-bold text-white text-sm mb-4">Platform Comparison</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {platformComparisons.map((p) => (
            <div key={p.name} className={`rounded-xl border p-4 flex flex-col gap-3 ${p.bg} hover:border-opacity-30 transition-colors`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${p.color}`}>{p.name}</span>
                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black border ${p.bg} ${p.color}`}>{p.abbr}</span>
              </div>
              <div>
                <p className="text-lg font-display font-extrabold text-white">{p.views}</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">views</p>
              </div>
              <div className="w-full bg-black/20 rounded-full h-1">
                <div className={`h-1 rounded-full ${p.barColor}`} style={{width: `${p.bar}%`}} />
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground/50">{p.engagement} eng.</span>
                <span className="text-emerald-400 font-semibold">{p.followers}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.3}} className="glass-card p-5 h-[380px] flex flex-col">
          <h3 className="font-display font-bold text-white text-sm mb-4">Engagement Trajectory</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff', fontSize: '11px' }} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }} />
                <Line type="monotone" dataKey="ig" name="Instagram" stroke="hsl(262, 83%, 58%)" strokeWidth={2.5} dot={false} activeDot={{r: 5, strokeWidth: 0}} />
                <Line type="monotone" dataKey="tt" name="TikTok" stroke="hsl(185, 85%, 48%)" strokeWidth={2.5} dot={false} activeDot={{r: 5, strokeWidth: 0}} />
                <Line type="monotone" dataKey="yt" name="YouTube" stroke="hsl(330, 75%, 60%)" strokeWidth={2.5} dot={false} activeDot={{r: 5, strokeWidth: 0}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.4}} className="glass-card p-5 h-[380px] flex flex-col">
          <h3 className="font-display font-bold text-white text-sm mb-4">Views vs Likes (Weekly)</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                <RechartsTooltip contentStyle={tooltipStyle} cursor={{fill: 'rgba(255,255,255,0.02)'}} itemStyle={{ color: '#fff', fontSize: '11px' }} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }} />
                <Bar dataKey="views" name="Views" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="likes" name="Likes" fill="hsl(185, 85%, 48%)" radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Heatmap + Best Times + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-accent/15 flex items-center justify-center border border-accent/10">
                <TrendingUp className="w-3 h-3 text-accent" />
              </div>
              Engagement Heatmap
            </h3>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[240px]">
              <div className="grid grid-cols-9 gap-1 mb-1">
                <div />
                {HEATMAP_HOURS.map(h => (
                  <div key={h} className="text-center text-[8px] text-muted-foreground/30 font-mono">{h}</div>
                ))}
              </div>
              {engagementHeatmap.map((row, di) => (
                <div key={HEATMAP_DAYS[di]} className="grid grid-cols-9 gap-1 mb-1">
                  <div className="text-[9px] text-muted-foreground/40 flex items-center font-medium">{HEATMAP_DAYS[di]}</div>
                  {row.map((val, hi) => {
                    const intensity = val / 10;
                    return (
                      <div
                        key={hi}
                        title={`${HEATMAP_DAYS[di]} ${HEATMAP_HOURS[hi]}: ${val * 10}% engagement`}
                        className="aspect-square rounded cursor-pointer transition-transform hover:scale-125"
                        style={{
                          backgroundColor: `rgba(6, 182, 212, ${0.04 + intensity * 0.85})`,
                          boxShadow: intensity > 0.7 ? `0 0 6px rgba(6,182,212,${intensity * 0.4})` : 'none'
                        }}
                      />
                    );
                  })}
                </div>
              ))}
              <div className="flex items-center justify-end gap-2 mt-3 text-[9px] text-muted-foreground/30">
                <span>Low</span>
                <div className="w-16 h-1.5 rounded-full" style={{background: 'linear-gradient(to right, rgba(6,182,212,0.04), rgba(6,182,212,0.9))'}} />
                <span>High</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center border border-primary/10">
                <Clock className="w-3 h-3 text-primary" />
              </div>
              Best Posting Times
            </h3>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {['M','Tu','W','Th','F','Sa','Su'].map(d => <div key={d} className="text-center text-[9px] text-muted-foreground/30 pb-2 font-medium">{d}</div>)}
            {[...Array(56)].map((_, i) => {
              const isHot = [10, 11, 17, 18, 24, 25, 31, 38, 45].includes(i);
              const isWarm = [9, 12, 16, 19, 23, 26, 30, 32, 37, 39, 44, 46].includes(i);
              return (
                <div key={i} className={`aspect-square rounded transition-all hover:scale-125 cursor-pointer ${
                  isHot ? 'bg-primary' : 
                  isWarm ? 'bg-primary/40' : 
                  'bg-white/[0.03]'
                }`} 
                style={isHot ? { boxShadow: '0 0 8px rgba(124, 58, 237, 0.6)' } : undefined} />
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-4 text-[10px] text-muted-foreground/30 font-mono">
            <span>00:00</span>
            <div className="flex gap-2 items-center">
              <span>Low</span>
              <div className="w-12 h-1.5 bg-gradient-to-r from-white/[0.03] to-primary rounded-full"></div>
              <span>High</span>
            </div>
            <span>24:00</span>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="font-display font-bold text-white text-sm mb-5">Top Performing Videos</h3>
          <div className="space-y-3">
            {topVideos.map((video, i) => (
              <div key={video.id} className="flex items-center gap-3 group cursor-pointer p-2 rounded-xl hover:bg-white/[0.02] transition-colors -mx-2">
                <span className="text-xl font-display font-black text-white/[0.06] w-5 shrink-0 text-center">{i + 1}</span>
                <div className="w-9 h-12 bg-black/30 rounded-lg border border-white/[0.06] group-hover:border-primary/30 transition-colors flex items-center justify-center shrink-0">
                  <Play className="w-2.5 h-2.5 text-muted-foreground/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 font-medium text-[12px] truncate">{video.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${platformBadge[video.platform] || 'bg-white/5 text-white/50 border-white/10'}`}>{video.platform}</span>
                    <span className="text-[10px] text-muted-foreground/40">{video.views}</span>
                  </div>
                </div>
                <span className="text-primary font-bold text-xs shrink-0">{video.engagement}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
