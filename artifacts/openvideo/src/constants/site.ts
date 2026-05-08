export const SITE_URL = "https://bviral.com";

export const SITE_INFO = {
  title: "BVIRAL Video Editor",
  description: "A browser video editor for BVIRAL creators.",
  url: SITE_URL,
  openGraphImage: "/open-graph/default.jpg",
  twitterImage: "/open-graph/default.jpg",
  favicon: "/favicon.ico",
};

export const EXTERNAL_TOOLS = [
  {
    name: "Marble",
    description: "Modern headless CMS for content management.",
    url: "https://marblecms.com?utm_source=bviral",
    icon: "MarbleIcon" as const,
  },
  {
    name: "Vercel",
    description: "Platform for deploying and hosting web apps.",
    url: "https://vercel.com?utm_source=bviral",
    icon: "VercelIcon" as const,
  },
  {
    name: "Databuddy",
    description: "GDPR compliant analytics and user insights.",
    url: "https://databuddy.cc?utm_source=bviral",
    icon: "DataBuddyIcon" as const,
  },
];
