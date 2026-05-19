import type {
  Account,
  AccountPlatform,
  Alert,
  AnalyticsOverview,
  Post,
} from "@workspace/api-client-react";

export type RecommendationCategory =
  | "warning"
  | "opportunity"
  | "optimization"
  | "growth"
  | "celebration"
  | "info";

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  priority: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  cta?: { label: string; href: string };
}

const platformLabels: Record<AccountPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

const allPlatforms: AccountPlatform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "snapchat",
];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOUR_BANDS = ["12–3am", "3–6am", "6–9am", "9am–12pm", "12–3pm", "3–6pm", "6–9pm", "9pm–12am"];

function joinWithAnd(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

function daysBetween(later: Date, earlier: Date) {
  return Math.round((later.getTime() - earlier.getTime()) / DAY_MS);
}

export interface RecommendationInput {
  analytics: AnalyticsOverview;
  alerts: Alert[];
  accounts: Account[];
  posts: Post[];
}

export function generateRecommendations(input: RecommendationInput): Recommendation[] {
  const { analytics, alerts, accounts, posts } = input;
  const now = Date.now();
  const recs: Recommendation[] = [];

  const totals = analytics.totals;
  const byPlatform = analytics.byPlatform;
  const timeline = analytics.timeline;
  const topPosts = analytics.topPosts;

  const unresolvedAlerts = alerts.filter((alert) => alert.status === "unresolved");
  const scheduledPosts = posts.filter((post) => post.status === "scheduled");
  const postedPosts = posts.filter((post) => post.status === "posted");
  const failedPosts = posts.filter((post) => post.status === "failed");

  const connectedPlatforms = new Set(accounts.map((account) => account.platform));
  const disconnectedPlatforms = allPlatforms.filter((platform) => !connectedPlatforms.has(platform));

  const expiredAccounts = accounts.filter(
    (account) => account.tokenExpiry && new Date(account.tokenExpiry).getTime() <= now,
  );
  const expiringAccounts = accounts.filter((account) => {
    if (!account.tokenExpiry) return false;
    const expiry = new Date(account.tokenExpiry).getTime();
    return expiry > now && expiry - now <= 7 * DAY_MS;
  });

  // 1. Empty state — nothing has happened yet.
  if (totals.views === 0 && posts.length === 0) {
    recs.push({
      id: "empty-state",
      category: "opportunity",
      priority: 2,
      title: "Publish your first post",
      body: "Connect at least one account, upload a clip, and schedule a publish so this dashboard can start showing real numbers.",
      cta: { label: "Open Scheduling", href: "/scheduling" },
    });
  }

  // 2. Disconnected platforms — encourage spreading.
  if (disconnectedPlatforms.length > 0 && accounts.length > 0) {
    const names = disconnectedPlatforms.map((platform) => platformLabels[platform]);
    recs.push({
      id: "disconnected-platforms",
      category: "opportunity",
      priority: 4,
      title: `${disconnectedPlatforms.length} ${pluralize(disconnectedPlatforms.length, "platform")} still untouched`,
      body: `Add ${joinWithAnd(names)} — every new platform unlocks a different algorithm and a fresh audience.`,
      cta: { label: "Connect", href: "/accounts" },
    });
  }

  // 3. Expired tokens — urgent.
  if (expiredAccounts.length > 0) {
    const platformNames = joinWithAnd(
      Array.from(new Set(expiredAccounts.map((account) => platformLabels[account.platform]))),
    );
    recs.push({
      id: "expired-tokens",
      category: "warning",
      priority: 1,
      title: `${expiredAccounts.length} ${pluralize(expiredAccounts.length, "account")} offline`,
      body: `Tokens for ${platformNames} have expired. Scheduled posts will fail until you reconnect.`,
      cta: { label: "Reconnect", href: "/accounts" },
    });
  }

  // 4. Tokens expiring within 7 days — preemptive.
  if (expiringAccounts.length > 0) {
    const soonest = expiringAccounts
      .slice()
      .sort((a, b) =>
        new Date(a.tokenExpiry ?? 0).getTime() - new Date(b.tokenExpiry ?? 0).getTime(),
      )[0];
    const daysLeft = Math.max(0, daysBetween(new Date(soonest.tokenExpiry ?? now), new Date(now)));
    recs.push({
      id: "expiring-tokens",
      category: "warning",
      priority: 2,
      title: `${platformLabels[soonest.platform]} token expires in ${daysLeft} ${pluralize(daysLeft, "day")}`,
      body: `Refresh now to avoid a publishing outage. ${expiringAccounts.length > 1 ? `${expiringAccounts.length - 1} other ${pluralize(expiringAccounts.length - 1, "token")} also expire this week.` : ""}`.trim(),
      cta: { label: "Refresh tokens", href: "/accounts" },
    });
  }

  // 5. Empty queue tomorrow.
  const scheduledNext24h = scheduledPosts.filter((post) => {
    const time = new Date(post.scheduledAt).getTime();
    return time > now && time <= now + DAY_MS;
  });
  if (scheduledNext24h.length === 0 && postedPosts.length > 0) {
    recs.push({
      id: "empty-queue",
      category: "optimization",
      priority: 3,
      title: "Tomorrow's queue is empty",
      body: "No posts scheduled in the next 24 hours. Drop at least two clips into the queue to keep your cadence intact.",
      cta: { label: "Schedule posts", href: "/scheduling" },
    });
  } else if (scheduledNext24h.length > 10) {
    // 6. Heavy queue — risk of rate limiting.
    recs.push({
      id: "heavy-queue",
      category: "optimization",
      priority: 3,
      title: `${scheduledNext24h.length} posts queued for tomorrow`,
      body: "Heavy load. Stagger by platform and space at least 20 minutes apart to dodge per-account rate limits.",
      cta: { label: "Review queue", href: "/scheduling" },
    });
  }

  // 7. Platform dominance — leverage what's working.
  if (totals.views > 0) {
    const dominant = byPlatform
      .filter((platform) => platform.views > 0)
      .sort((a, b) => b.views - a.views)[0];
    if (dominant) {
      const share = (dominant.views / totals.views) * 100;
      if (share >= 55 && byPlatform.filter((p) => p.views > 0).length > 1) {
        const mirrorTarget = byPlatform.find(
          (platform) => platform.platform !== dominant.platform && connectedPlatforms.has(platform.platform),
        );
        const mirrorName = mirrorTarget
          ? platformLabels[mirrorTarget.platform]
          : platformLabels[disconnectedPlatforms[0] ?? "instagram"];
        recs.push({
          id: "platform-dominance",
          category: "opportunity",
          priority: 3,
          title: `${platformLabels[dominant.platform]} owns ${share.toFixed(0)}% of your reach`,
          body: `Mirror your top three ${platformLabels[dominant.platform]} hits to ${mirrorName} — same hook, vertical 9:16. Free leverage.`,
        });
      }
    }
  }

  // 8. Underused platform — accounts connected but barely posting.
  for (const platform of byPlatform) {
    if (!connectedPlatforms.has(platform.platform)) continue;
    if (totals.views === 0) continue;
    const viewShare = (platform.views / Math.max(totals.views, 1)) * 100;
    const postShare = (platform.posts / Math.max(totals.posts, 1)) * 100;
    if (viewShare < 5 && postShare < 20 && platform.posts <= 2) {
      recs.push({
        id: `underused-${platform.platform}`,
        category: "opportunity",
        priority: 3,
        title: `${platformLabels[platform.platform]} is being left cold`,
        body: `Account connected, but only ${viewShare.toFixed(1)}% of your views. Post three times there this week and let the algorithm find you.`,
        cta: { label: "Schedule there", href: "/scheduling" },
      });
      break; // one underused-platform rec is enough
    }
  }

  // 9. Top post hugely outperforming engagement-wise.
  if (topPosts.length >= 2) {
    const sortedByEngagement = topPosts.slice().sort((a, b) => b.engagementRate - a.engagementRate);
    const star = sortedByEngagement[0];
    const avgEngagement =
      topPosts.reduce((sum, post) => sum + post.engagementRate, 0) / topPosts.length;
    if (avgEngagement > 0 && star.engagementRate >= avgEngagement * 2) {
      const daysAgo = daysBetween(new Date(now), new Date(star.fetchedAt));
      recs.push({
        id: "top-post-engagement",
        category: "growth",
        priority: 2,
        title: `Your ${platformLabels[star.platform]} post is ${(star.engagementRate / Math.max(avgEngagement, 0.01)).toFixed(1)}× your average`,
        body: `${star.engagementRate.toFixed(1)}% engagement vs your ${avgEngagement.toFixed(1)}% baseline${daysAgo > 0 ? ` (posted ${daysAgo} ${pluralize(daysAgo, "day")} ago)` : ""}. Cut a second variant in the same format and post within 48 hours.`,
        cta: { label: "Open analytics", href: "/analytics" },
      });
    }
  }

  // 10. Top post by views not cross-posted elsewhere.
  if (topPosts.length > 0 && posts.length > 0) {
    const topByViews = topPosts.slice().sort((a, b) => b.views - a.views)[0];
    if (topByViews && topByViews.views >= 10_000) {
      const topPostRecord = posts.find((post) => post.id === topByViews.postId);
      if (topPostRecord) {
        const otherPlatformsForVideo = new Set(
          posts
            .filter((post) => post.videoId === topPostRecord.videoId)
            .map((post) => post.platform),
        );
        const crossPostTarget = allPlatforms.find(
          (platform) => platform !== topByViews.platform && connectedPlatforms.has(platform) && !otherPlatformsForVideo.has(platform),
        );
        if (crossPostTarget) {
          recs.push({
            id: "cross-post-top",
            category: "opportunity",
            priority: 3,
            title: `Cross-post your top ${platformLabels[topByViews.platform]} clip`,
            body: `${topByViews.views.toLocaleString()} views and counting. The same asset on ${platformLabels[crossPostTarget]} is one upload away — fresh audience, zero new production cost.`,
            cta: { label: "Schedule cross-post", href: "/scheduling" },
          });
        }
      }
    }
  }

  // 11. Low engagement rate — hooks aren't holding.
  if (totals.views >= 1_000 && totals.engagementRate > 0 && totals.engagementRate < 1.5) {
    recs.push({
      id: "low-engagement",
      category: "optimization",
      priority: 4,
      title: `Engagement at ${totals.engagementRate.toFixed(1)}% — below the 1.5% floor`,
      body: "Your hooks aren't holding past the first two seconds. Try opening with a question, a stark visual contrast, or a number callout instead of a slow build.",
    });
  }

  // 12. High engagement, low reach — content is good, distribution isn't.
  if (totals.engagementRate >= 4 && totals.views > 0 && totals.views < 5_000) {
    recs.push({
      id: "high-engagement-low-reach",
      category: "opportunity",
      priority: 3,
      title: "Strong content, weak distribution",
      body: `${totals.engagementRate.toFixed(1)}% engagement is top-quartile, but only ${totals.views.toLocaleString()} views. The algorithm hasn't found you yet — post 4–5× per week for two weeks straight.`,
    });
  }

  // 13. High comment-to-like ratio — your audience is talking.
  if (totals.likes > 100) {
    const commentRatio = totals.comments / totals.likes;
    if (commentRatio > 0.15) {
      recs.push({
        id: "high-comment-ratio",
        category: "growth",
        priority: 3,
        title: "Your audience is unusually vocal",
        body: `Comment-to-like ratio is ${(commentRatio * 100).toFixed(0)}% — roughly ${(commentRatio / 0.07).toFixed(1)}× the norm. Reply to the top ten comments in the first hour after each post. Comment velocity compounds reach.`,
      });
    }
  }

  // 14. Failed posts in last 7 days.
  const recentFailures = failedPosts.filter((post) => {
    const reference = post.postedAt ?? post.scheduledAt;
    return reference && new Date(reference).getTime() >= now - 7 * DAY_MS;
  });
  if (recentFailures.length > 0) {
    const latest = recentFailures
      .slice()
      .sort((a, b) =>
        new Date(b.postedAt ?? b.scheduledAt).getTime() - new Date(a.postedAt ?? a.scheduledAt).getTime(),
      )[0];
    const errorSnippet = latest.errorMessage
      ? ` Last failure: "${latest.errorMessage.slice(0, 80)}${latest.errorMessage.length > 80 ? "…" : ""}"`
      : "";
    recs.push({
      id: "failed-posts",
      category: "warning",
      priority: 2,
      title: `${recentFailures.length} ${pluralize(recentFailures.length, "post")} failed in the last week`,
      body: `Audit the publishing pipeline before scheduling more.${errorSnippet}`,
      cta: { label: "Open scheduling", href: "/scheduling" },
    });
  }

  // 15. Copyright strikes — protect future reach.
  const copyrightAlerts = unresolvedAlerts.filter((alert) => alert.type === "copyright");
  if (copyrightAlerts.length > 0) {
    recs.push({
      id: "copyright-strikes",
      category: "warning",
      priority: 1,
      title: `${copyrightAlerts.length} copyright ${pluralize(copyrightAlerts.length, "strike")} open`,
      body: "Unresolved strikes can mute reach across the entire account. Triage these before publishing anything new.",
      cta: { label: "Open alerts", href: "/alerts" },
    });
  }

  // 16/17. Week-over-week movement (only when we have ≥14 timeline days).
  if (timeline.length >= 14) {
    const sorted = timeline.slice().sort((a, b) => a.date.localeCompare(b.date));
    const lastSeven = sorted.slice(-7);
    const priorSeven = sorted.slice(-14, -7);
    const lastViews = lastSeven.reduce((sum, point) => sum + point.views, 0);
    const priorViews = priorSeven.reduce((sum, point) => sum + point.views, 0);
    if (priorViews >= 100) {
      const pctChange = ((lastViews - priorViews) / priorViews) * 100;
      if (pctChange >= 25) {
        const bestDay = lastSeven.slice().sort((a, b) => b.views - a.views)[0];
        const bestDayName = bestDay
          ? new Date(bestDay.date).toLocaleDateString(undefined, { weekday: "long" })
          : "your peak day";
        recs.push({
          id: "wow-growth",
          category: "celebration",
          priority: 4,
          title: `Views up ${pctChange.toFixed(0)}% week-over-week`,
          body: `Momentum is real. ${bestDayName} drove the biggest spike — repeat that format and double down on the platform that carried it.`,
        });
      } else if (pctChange <= -25) {
        recs.push({
          id: "wow-decline",
          category: "optimization",
          priority: 3,
          title: `Views down ${Math.abs(pctChange).toFixed(0)}% week-over-week`,
          body: "Three usual suspects: format fatigue, off-peak posting times, or thumbnail/hook drift. Audit your last three posts side-by-side and find the variable that changed.",
        });
      }
    }
  }

  // 18. Account:posts imbalance — lots of accounts, barely posting.
  if (accounts.length >= 4 && postedPosts.length > 0 && postedPosts.length < accounts.length) {
    const ratio = accounts.length / Math.max(postedPosts.length, 1);
    recs.push({
      id: "accounts-posts-gap",
      category: "opportunity",
      priority: 4,
      title: `${accounts.length} accounts, only ${postedPosts.length} ${pluralize(postedPosts.length, "post")}`,
      body: `You're underutilizing your reach by roughly ${ratio.toFixed(1)}×. One clip can fan out to every connected platform — the upload is the expensive part, not the publish.`,
      cta: { label: "Schedule posts", href: "/scheduling" },
    });
  }

  // 19. Best posting slot — derive from postedAt + view weights.
  if (postedPosts.length >= 5 && topPosts.length > 0) {
    const viewsByPostId = new Map(topPosts.map((post) => [post.postId, post.views]));
    const buckets = new Map<string, { score: number; samples: number; day: number; band: number }>();
    for (const post of postedPosts) {
      const reference = post.postedAt ? new Date(post.postedAt) : null;
      if (!reference) continue;
      const day = reference.getDay();
      const band = Math.floor(reference.getHours() / 3);
      const key = `${day}-${band}`;
      const existing = buckets.get(key) ?? { score: 0, samples: 0, day, band };
      const weight = viewsByPostId.get(post.id) ?? 0;
      existing.score += weight;
      existing.samples += 1;
      buckets.set(key, existing);
    }
    const ranked = Array.from(buckets.values())
      .filter((bucket) => bucket.samples >= 2)
      .sort((a, b) => b.score / b.samples - a.score / a.samples);
    const top = ranked[0];
    if (top && top.score > 0) {
      const avgViews = Math.round(top.score / top.samples);
      const baseline = postedPosts
        .map((post) => viewsByPostId.get(post.id) ?? 0)
        .reduce((sum, value) => sum + value, 0) / Math.max(postedPosts.length, 1);
      const multiplier = baseline > 0 ? (avgViews / baseline).toFixed(1) : "—";
      recs.push({
        id: "best-posting-slot",
        category: "optimization",
        priority: 4,
        title: `Your best slot is ${DAY_NAMES[top.day]}s ${HOUR_BANDS[top.band]}`,
        body: `Posts in this window average ${avgViews.toLocaleString()} views — ${multiplier}× your overall baseline. Move upcoming scheduled posts here.`,
        cta: { label: "Open scheduling", href: "/scheduling" },
      });
    }
  }

  // 20. Steady-state fallback — only if we have almost no signals.
  if (recs.length < 2) {
    recs.push({
      id: "steady-state",
      category: "info",
      priority: 5,
      title: "Everything looks healthy",
      body: "No urgent signals. Maintain your posting cadence and check back tomorrow — the engine watches your engagement curve continuously.",
    });
  }

  return recs.sort((a, b) => a.priority - b.priority).slice(0, 6);
}
