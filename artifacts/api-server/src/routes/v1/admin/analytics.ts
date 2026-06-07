import type { FastifyInstance } from "fastify";
import { z } from "zod";

const platformValues = ["facebook", "instagram", "tiktok", "youtube", "snapchat"] as const;

const overviewQuerySchema = z.object({
  creatorId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  postId: z.string().uuid().optional(),
  videoId: z.string().uuid().optional(),
  platform: z.enum(platformValues).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/gu, "\"\"")}"`;
  }
  return str;
}

export default async function adminAnalyticsRoutes(fastify: FastifyInstance) {
  fastify.get("/analytics/overview", async (request) => {
    const query = overviewQuerySchema.parse(request.query);
    return fastify.analyticsService.getOverviewFiltered(query);
  });

  fastify.get("/analytics/export.csv", async (request, reply) => {
    const query = overviewQuerySchema.parse(request.query);
    const overview = await fastify.analyticsService.getOverviewFiltered(query);

    const lines: string[] = [];
    lines.push("section,metric,value");
    lines.push(`totals,views,${overview.totals.views}`);
    lines.push(`totals,likes,${overview.totals.likes}`);
    lines.push(`totals,comments,${overview.totals.comments}`);
    lines.push(`totals,shares,${overview.totals.shares}`);
    lines.push(`totals,revenue,${overview.totals.revenue}`);
    lines.push(`totals,posts,${overview.totals.posts}`);
    lines.push(`totals,engagementRate,${overview.totals.engagementRate}`);
    lines.push("");
    lines.push("platform,views,likes,comments,shares,revenue,posts");
    for (const platform of overview.byPlatform) {
      lines.push([
        platform.platform,
        platform.views,
        platform.likes,
        platform.comments,
        platform.shares,
        platform.revenue,
        platform.posts,
      ].map(escapeCsv).join(","));
    }
    lines.push("");
    lines.push("date,views,likes,comments,shares");
    for (const point of overview.timeline) {
      lines.push([
        point.date,
        point.views,
        point.likes,
        point.comments,
        point.shares,
      ].map(escapeCsv).join(","));
    }
    lines.push("");
    lines.push("postId,platform,externalPostId,views,likes,comments,shares,revenue,engagementRate,fetchedAt");
    for (const post of overview.topPosts) {
      lines.push([
        post.postId,
        post.platform,
        post.externalPostId ?? "",
        post.views,
        post.likes,
        post.comments,
        post.shares,
        post.revenue,
        post.engagementRate,
        post.fetchedAt,
      ].map(escapeCsv).join(","));
    }

    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header(
      "content-disposition",
      `attachment; filename="analytics-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return lines.join("\n");
  });
}
