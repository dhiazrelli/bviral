import type { ReactNode } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminOnly } from "@/components/auth/AdminOnly";
import NotFound from "@/pages/not-found";
import { Shell } from "@/components/layout/Shell";

// Public pages
import Login from "@/pages/Login";

// Protected pages
import Dashboard from "@/pages/Dashboard";
import Scheduling from "@/pages/Scheduling";
import AiVideoStudio from "@/pages/AiVideoStudio";
import Analytics from "@/pages/Analytics";
import Alerts from "@/pages/Alerts";
import Accounts from "@/pages/Accounts";
import Settings from "@/pages/Settings";

// Admin pages
import Creators from "@/pages/admin/Creators";
import CreatorDetail from "@/pages/admin/CreatorDetail";
import AllPosts from "@/pages/admin/AllPosts";
import AllVideos from "@/pages/admin/AllVideos";
import GlobalAnalytics from "@/pages/admin/GlobalAnalytics";
import Trash from "@/pages/admin/Trash";
import AuditLog from "@/pages/admin/AuditLog";
import SystemHealth from "@/pages/admin/SystemHealth";

const queryClient = new QueryClient();

function adminRoute(component: ReactNode) {
  return (
    <ProtectedRoute>
      <AdminOnly>
        <Shell>{component}</Shell>
      </AdminOnly>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/admin/creators/:id">
        {(params) => adminRoute(<CreatorDetail id={params.id} />)}
      </Route>
      <Route path="/admin/creators">{adminRoute(<Creators />)}</Route>
      <Route path="/admin/posts">{adminRoute(<AllPosts />)}</Route>
      <Route path="/admin/videos">{adminRoute(<AllVideos />)}</Route>
      <Route path="/admin/analytics">{adminRoute(<GlobalAnalytics />)}</Route>
      <Route path="/admin/trash">{adminRoute(<Trash />)}</Route>
      <Route path="/admin/audit-log">{adminRoute(<AuditLog />)}</Route>
      <Route path="/admin/system">{adminRoute(<SystemHealth />)}</Route>

      <Route>
        <ProtectedRoute>
          <Shell>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/scheduling" component={Scheduling} />
              <Route path="/ai-video-studio" component={AiVideoStudio} />
              <Route path="/analytics" component={Analytics} />
              <Route path="/alerts" component={Alerts} />
              <Route path="/accounts" component={Accounts} />
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </Shell>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
