import fp from "fastify-plugin";
import { platformValues } from "@workspace/db";

const uuidPattern =
  "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

export default fp(async function analyticsSchemas(fastify) {
  fastify.addSchema({
    $id: "analyticsSnapshot",
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", pattern: uuidPattern },
      postId: { type: "string", pattern: uuidPattern },
      views: { type: "integer" },
      likes: { type: "integer" },
      comments: { type: "integer" },
      shares: { type: "integer" },
      revenue: { type: "number" },
      fetchedAt: { type: "string" },
    },
    required: ["id", "postId", "views", "likes", "comments", "shares", "revenue", "fetchedAt"],
  });

  fastify.addSchema({
    $id: "analyticsPlatformTotals",
    type: "object",
    additionalProperties: false,
    properties: {
      platform: { type: "string", enum: [...platformValues] },
      views: { type: "integer" },
      likes: { type: "integer" },
      comments: { type: "integer" },
      shares: { type: "integer" },
      revenue: { type: "number" },
      posts: { type: "integer" },
    },
    required: ["platform", "views", "likes", "comments", "shares", "revenue", "posts"],
  });

  fastify.addSchema({
    $id: "analyticsTimelinePoint",
    type: "object",
    additionalProperties: false,
    properties: {
      date: { type: "string" },
      views: { type: "integer" },
      likes: { type: "integer" },
      comments: { type: "integer" },
      shares: { type: "integer" },
    },
    required: ["date", "views", "likes", "comments", "shares"],
  });

  fastify.addSchema({
    $id: "analyticsTopPost",
    type: "object",
    additionalProperties: false,
    properties: {
      postId: { type: "string", pattern: uuidPattern },
      platform: { type: "string", enum: [...platformValues] },
      externalPostId: { anyOf: [{ type: "string" }, { type: "null" }] },
      views: { type: "integer" },
      likes: { type: "integer" },
      comments: { type: "integer" },
      shares: { type: "integer" },
      revenue: { type: "number" },
      engagementRate: { type: "number" },
      fetchedAt: { type: "string" },
    },
    required: [
      "postId",
      "platform",
      "externalPostId",
      "views",
      "likes",
      "comments",
      "shares",
      "revenue",
      "engagementRate",
      "fetchedAt",
    ],
  });

  fastify.addSchema({
    $id: "analyticsOverview",
    type: "object",
    additionalProperties: false,
    properties: {
      totals: {
        type: "object",
        additionalProperties: false,
        properties: {
          views: { type: "integer" },
          likes: { type: "integer" },
          comments: { type: "integer" },
          shares: { type: "integer" },
          revenue: { type: "number" },
          posts: { type: "integer" },
          engagementRate: { type: "number" },
        },
        required: ["views", "likes", "comments", "shares", "revenue", "posts", "engagementRate"],
      },
      byPlatform: {
        type: "array",
        items: { $ref: "analyticsPlatformTotals#" },
      },
      timeline: {
        type: "array",
        items: { $ref: "analyticsTimelinePoint#" },
      },
      topPosts: {
        type: "array",
        items: { $ref: "analyticsTopPost#" },
      },
    },
    required: ["totals", "byPlatform", "timeline", "topPosts"],
  });

  fastify.addSchema({
    $id: "postAnalytics",
    type: "object",
    additionalProperties: false,
    properties: {
      postId: { type: "string", pattern: uuidPattern },
      platform: { type: "string", enum: [...platformValues] },
      externalPostId: { anyOf: [{ type: "string" }, { type: "null" }] },
      latest: { anyOf: [{ $ref: "analyticsSnapshot#" }, { type: "null" }] },
      history: {
        type: "array",
        items: { $ref: "analyticsSnapshot#" },
      },
    },
    required: ["postId", "platform", "externalPostId", "latest", "history"],
  });
}, {
  name: "analytics-schemas",
});
