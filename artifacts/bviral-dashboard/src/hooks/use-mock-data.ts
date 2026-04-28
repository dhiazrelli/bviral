import { useState, useEffect } from 'react';

// Centralized mock data provider to simulate API delays and state
export function useDashboardData() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    metrics: [
      { title: "Total Videos", value: "12,847", change: "+14.2%", isPositive: true, icon: "Video" },
      { title: "Scheduled Posts", value: "3,294", change: "+5.4%", isPositive: true, icon: "Calendar" },
      { title: "Total Income", value: "$847,392", change: "+24.8%", isPositive: true, icon: "DollarSign" },
      { title: "Total Errors", value: "23", change: "-12.5%", isPositive: true, icon: "AlertTriangle" },
      { title: "Active Accounts", value: "156", change: "+2", isPositive: true, icon: "Users" },
      { title: "Viral Videos", value: "847", change: "+42.1%", isPositive: true, icon: "TrendingUp" }
    ],
    chartData: [
      { name: 'Week 1', instagram: 4000, tiktok: 2400, youtube: 2400 },
      { name: 'Week 2', instagram: 3000, tiktok: 1398, youtube: 2210 },
      { name: 'Week 3', instagram: 2000, tiktok: 9800, youtube: 2290 },
      { name: 'Week 4', instagram: 2780, tiktok: 3908, youtube: 2000 },
      { name: 'Week 5', instagram: 1890, tiktok: 4800, youtube: 2181 },
      { name: 'Week 6', instagram: 2390, tiktok: 3800, youtube: 2500 },
      { name: 'Week 7', instagram: 3490, tiktok: 4300, youtube: 2100 },
      { name: 'Week 8', instagram: 4000, tiktok: 5400, youtube: 2900 },
    ],
    platformDistribution: [
      { name: 'Instagram', value: 35, color: 'var(--color-chart-1)' },
      { name: 'TikTok', value: 28, color: 'var(--color-chart-2)' },
      { name: 'YouTube', value: 20, color: 'var(--color-chart-3)' },
      { name: 'Facebook', value: 10, color: 'var(--color-chart-4)' },
      { name: 'Snapchat', value: 7, color: 'var(--color-chart-5)' },
    ],
    activityFeed: [
      { id: 1, user: "Auto-Scheduler", action: "Published 15 videos across 5 accounts", time: "2 mins ago", status: "success" },
      { id: 2, user: "AI Engine", action: "Generated 42 new short variations", time: "15 mins ago", status: "info" },
      { id: 3, user: "API Gateway", action: "Rate limit warning on TikTok API", time: "1 hour ago", status: "warning" },
      { id: 4, user: "System", action: "Completed bulk upload of 120 assets", time: "3 hours ago", status: "success" },
      { id: 5, user: "Auto-Scheduler", action: "Failed to publish to @ViralCats (Token Expired)", time: "5 hours ago", status: "error" },
    ],
    systemHealth: [
      { service: "API Gateway", status: "Operational", uptime: "99.99%", ping: "24ms" },
      { service: "Scheduler", status: "Operational", uptime: "100%", ping: "12ms" },
      { service: "Video Processor", status: "Heavy Load", uptime: "99.95%", ping: "145ms" },
      { service: "CDN Edge", status: "Operational", uptime: "100%", ping: "8ms" },
    ]
  };
}

export function useSchedulingData() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    accounts: [
      { id: 1, name: "@LuxuryLife", platform: "Instagram", tag: "Lifestyle", scheduled: 45, lastUpload: "2 hours ago", status: "Active" },
      { id: 2, name: "@TechGadgets", platform: "TikTok", tag: "Tech", scheduled: 12, lastUpload: "1 day ago", status: "Active" },
      { id: 3, name: "Crypto Insights", platform: "YouTube", tag: "Finance", scheduled: 8, lastUpload: "3 days ago", status: "Paused" },
      { id: 4, name: "@DailyMemes", platform: "Snapchat", tag: "Humor", scheduled: 102, lastUpload: "15 mins ago", status: "Active" },
      { id: 5, name: "Fitness Journey", platform: "Facebook", tag: "Health", scheduled: 0, lastUpload: "1 week ago", status: "Error" },
      { id: 6, name: "@TravelWonders", platform: "Instagram", tag: "Travel", scheduled: 24, lastUpload: "5 hours ago", status: "Active" },
      { id: 7, name: "@FoodPorn", platform: "TikTok", tag: "Food", scheduled: 56, lastUpload: "1 hour ago", status: "Active" },
    ]
  };
}

export function useAlertsData() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    alerts: [
      { id: 1, type: "API Error", title: "Instagram API Rate Limit Exceeded", desc: "Account @LuxuryLife hit the hourly posting limit. Retrying in 45 mins.", platform: "Instagram", priority: "High", time: "10 mins ago" },
      { id: 2, type: "Copyright", title: "Audio Muted by TikTok", desc: "Video ID #8892 muted due to commercial audio restrictions in EU region.", platform: "TikTok", priority: "Critical", time: "1 hour ago" },
      { id: 3, type: "Warning", title: "Low Engagement Threshold", desc: "Last 3 posts on @TechGadgets performing 40% below average.", platform: "TikTok", priority: "Medium", time: "3 hours ago" },
      { id: 4, type: "System", title: "Video Render Queue Backed Up", desc: "Processing delay increased to 15 minutes per video.", platform: "System", priority: "Medium", time: "5 hours ago" },
      { id: 5, type: "Viral", title: "Viral Trajectory Detected", desc: "Post #9921 on @DailyMemes hitting 10k views/min. Consider boosting.", platform: "Snapchat", priority: "Low", time: "12 hours ago" },
      { id: 6, type: "Posting Failure", title: "Token Expired", desc: "Facebook integration for 'Fitness Journey' requires re-authentication.", platform: "Facebook", priority: "Critical", time: "1 day ago" },
    ]
  };
}
