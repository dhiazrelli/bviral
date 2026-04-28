import React, { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BellRing,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Command,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Sparkles,
  Users,
  Wand2,
  X,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import bviralLogo from "../../../../../bviral.png";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, section: "overview" },
  { path: "/scheduling", label: "Scheduling", icon: CalendarClock, section: "overview" },
  { path: "/ai-video-studio", label: "AI Studio", icon: Wand2, section: "creation" },
  { path: "/analytics", label: "Analytics", icon: BarChart3, section: "creation" },
  { path: "/alerts", label: "Alerts", icon: BellRing, badge: 3, section: "operations" },
  { path: "/accounts", label: "Accounts", icon: Users, section: "operations" },
  { path: "/settings", label: "Settings", icon: Settings, section: "operations" },
];

const sectionLabels: Record<string, string> = {
  overview: "Overview",
  creation: "Creation",
  operations: "Operations",
};

const pageDescriptions: Record<string, string> = {
  "/": "Track growth loops, publishing velocity, and operator signals in one place.",
  "/scheduling": "Coordinate the publishing queue across every managed social account.",
  "/ai-video-studio": "Generate, remix, and operationalize video variants with tighter feedback loops.",
  "/analytics": "Compare channels, identify breakout patterns, and surface revenue-moving trends.",
  "/alerts": "Review incidents, watchlist changes, and escalation paths before they affect output.",
  "/accounts": "Manage connected profiles, permissions, and account-level performance health.",
  "/settings": "Tune automations, workspace defaults, and security controls.",
};

function getCurrentItem(pathname: string) {
  return navItems.find((item) => item.path === pathname) ?? navItems[0];
}

function NavItem({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link href={item.path} className="block" onClick={onNavigate}>
      <motion.div
        whileHover={{ x: collapsed ? 0 : 2 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-200",
          active
            ? "border-white/12 bg-white/[0.08] text-white shadow-[0_20px_45px_rgba(2,10,22,0.2)]"
            : "border-transparent text-white/65 hover:border-white/8 hover:bg-white/[0.04] hover:text-white",
          collapsed && "justify-center px-0",
        )}
      >
        {active ? (
          <div className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary" />
        ) : null}
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors",
            active
              ? "border-primary/30 bg-primary/18 text-primary"
              : "border-white/8 bg-white/[0.04] text-white/65",
          )}
        >
          <item.icon className="h-[18px] w-[18px]" />
        </div>
        {collapsed ? null : (
          <>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{item.label}</p>
              <p className="truncate text-[11px] text-white/38">
                {item.section === "overview"
                  ? "Core signal"
                  : item.section === "creation"
                    ? "Creative ops"
                    : "Runbook"}
              </p>
            </div>
            {item.badge ? (
              <span className="ml-auto rounded-full bg-destructive/14 px-2 py-1 text-[10px] font-bold text-destructive">
                {item.badge}
              </span>
            ) : null}
          </>
        )}
      </motion.div>
    </Link>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCommandRoomOpen, setCommandRoomOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const shouldReduceMotion = useReducedMotion();
  const { toast } = useToast();

  const groupedNavItems = navItems.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }

    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  const currentItem = getCurrentItem(location);
  const currentDescription = pageDescriptions[location] ?? pageDescriptions["/"];
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return navItems;
    }

    return navItems.filter((item) =>
      [item.label, item.section, sectionLabels[item.section]].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [searchQuery]);

  const handleQuickNavigate = (path: string, label: string) => {
    navigate(path);
    setCommandRoomOpen(false);
    setMobileMenuOpen(false);
    toast({
      title: label,
      description: "View updated.",
    });
  };

  const handleSearchSubmit = () => {
    const nextItem = searchResults[0];

    if (!nextItem) {
      toast({
        title: "No matching workspace view",
        description: `No result for "${searchQuery.trim()}".`,
        variant: "destructive",
      });
      return;
    }

    handleQuickNavigate(nextItem.path, nextItem.label);
  };

  const openCommandRoom = () => {
    setCommandRoomOpen(true);
  };

  const showHelp = () => {
    toast({
      title: "Operator shortcuts",
      description: "Press Enter in search to jump pages, or use Command Room for quick navigation.",
    });
  };

  const openAlerts = () => {
    navigate("/alerts");
    toast({
      title: "Alerts",
      description: "Routing to the incident queue.",
    });
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/6 px-4 py-4">
        <div className="flex w-full justify-center">
          <img
            src={bviralLogo}
            alt="BViral"
            className={cn(
              "h-11 w-auto object-contain text-center drop-shadow-[0_16px_40px_rgba(255,146,74,0.16)]",
              isSidebarOpen ? "max-w-[9rem]" : "max-w-[2.75rem]",
            )}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {Object.entries(groupedNavItems).map(([section, items]) => (
          <div key={section} className="mb-5">
            {isSidebarOpen ? (
              <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/30">
                {sectionLabels[section]}
              </p>
            ) : (
              <div className="mx-auto mb-3 h-px w-8 bg-white/8" />
            )}
            <div className="space-y-2">
              {items.map((item) => (
                <NavItem
                  key={item.path}
                  item={item}
                  active={location === item.path}
                  collapsed={!isSidebarOpen}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/6 px-3 py-3">
        {isSidebarOpen ? (
          <div className="glass-card mb-3 rounded-[1.35rem] p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
                  Workspace
                </p>
                <p className="mt-1 text-sm font-semibold text-white">156 live accounts</p>
              </div>
              <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-[10px] font-bold text-emerald-300">
                Healthy
              </span>
            </div>
            <p className="text-[12px] leading-6 text-white/55">
              Publishing cadence is stable. Two channels are above breakout threshold today.
            </p>
          </div>
        ) : null}
        <button
          onClick={() => setSidebarOpen((value) => !value)}
          className="flex w-full items-center justify-center rounded-2xl border border-white/6 bg-white/[0.03] py-3 text-white/62 transition hover:bg-white/[0.06] hover:text-white"
        >
          {isSidebarOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-glow left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] bg-primary animate-glow-pulse" />
        <div
          className="bg-glow bottom-[-8rem] right-[-9rem] h-[25rem] w-[25rem] bg-accent animate-glow-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div className="dot-grid absolute inset-0 opacity-[0.04]" />
      </div>

      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 296 : 92 }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28 }}
        className="glass-panel relative z-20 hidden border-r md:flex"
      >
        {sidebarContent}
      </motion.aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="glass-panel sticky top-0 z-30 border-b border-white/6 px-4 py-4 lg:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <button
                className="rounded-2xl border border-white/8 bg-white/[0.04] p-3 text-white/70 md:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="surface-label mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Operating View
                </div>
                <h1 className="truncate text-[1.45rem] font-bold tracking-[-0.05em] text-white md:text-[1.9rem]">
                  {currentItem.label}
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-white/56">
                  {currentDescription}
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <div className="relative w-[20rem] xl:w-[24rem]">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/36" />
                <input
                  type="text"
                  placeholder="Search campaigns, accounts, or alerts"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSearchSubmit();
                    }
                  }}
                  className="input-field pl-10 pr-16"
                />
                <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full border border-white/8 bg-white/[0.05] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/36 xl:flex">
                  <Command className="h-3 w-3" />
                  K
                </span>
              </div>
              <button onClick={openCommandRoom} className="btn-secondary">
                <Sparkles className="h-4 w-4" />
                Command room
              </button>
              <button
                onClick={showHelp}
                className="relative rounded-2xl border border-white/8 bg-white/[0.04] p-3 text-white/72 transition hover:bg-white/[0.07] hover:text-white"
              >
                <HelpCircle className="h-4.5 w-4.5" />
              </button>
              <button
                onClick={openAlerts}
                className="relative rounded-2xl border border-white/8 bg-white/[0.04] p-3 text-white/72 transition hover:bg-white/[0.07] hover:text-white"
              >
                <BellRing className="h-4.5 w-4.5" />
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary" />
              </button>
              <div className="flex items-center gap-3 rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-3 py-2">
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-white">Admin User</p>
                  <p className="text-[11px] text-white/44">Operator</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent font-bold text-slate-950">
                  AU
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="min-h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/72 backdrop-blur-sm md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.38 }}
              className="glass-panel fixed inset-y-0 left-0 z-50 w-[20rem] border-r border-white/8 md:hidden"
            >
              <div className="flex items-center justify-between border-b border-white/6 px-4 py-4">
                <div className="flex flex-1 justify-center">
                  <img
                    src={bviralLogo}
                    alt="BViral"
                    className="h-11 w-auto max-w-[9rem] object-contain drop-shadow-[0_16px_40px_rgba(255,146,74,0.16)]"
                  />
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-2xl border border-white/8 bg-white/[0.04] p-2.5 text-white/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-3 py-4">{sidebarContent}</div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isCommandRoomOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-slate-950/72 backdrop-blur-sm"
              onClick={() => setCommandRoomOpen(false)}
            />
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="glass-panel fixed left-1/2 top-[12vh] z-[61] w-[min(92vw,34rem)] -translate-x-1/2 rounded-[1.8rem] border border-white/8 p-5 shadow-[0_30px_80px_rgba(2,10,22,0.45)]"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/36">
                    Command Room
                  </p>
                  <h2 className="mt-2 text-xl font-display font-bold text-white">
                    Jump between operating views
                  </h2>
                </div>
                <button
                  onClick={() => setCommandRoomOpen(false)}
                  className="rounded-2xl border border-white/8 bg-white/[0.04] p-2.5 text-white/70 transition hover:bg-white/[0.07] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                {navItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleQuickNavigate(item.path, item.label)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                      location === item.path
                        ? "border-primary/20 bg-primary/10 text-white"
                        : "border-white/8 bg-white/[0.03] text-white/72 hover:border-white/12 hover:bg-white/[0.05]",
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.05]">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-[11px] text-white/40">{sectionLabels[item.section]}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
