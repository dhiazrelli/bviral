import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon, User, Bell, Shield, Key, Palette,
  Globe, Zap, Save, ChevronRight, Moon, Sun, Monitor,
  Lock, Mail, Smartphone, Clock,
  Database, Cloud, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type SettingsSection = 'profile' | 'notifications' | 'security' | 'api-keys' | 'automation' | 'appearance';
type SessionRecord = { id: number; device: string; location: string; time: string; active: boolean };
type ApiKeyRecord = { id: number; name: string; status: 'active' | 'expired' | 'rate-limited'; key: string; lastUsed: string };

const sections: { id: SettingsSection; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'profile', label: 'Profile', icon: User, description: 'Account info and preferences' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alert and digest settings' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Password and 2FA' },
  { id: 'api-keys', label: 'API Keys', icon: Key, description: 'Platform integrations' },
  { id: 'automation', label: 'Automation', icon: Zap, description: 'Scheduling rules & AI config' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and display' },
];

const initialSessions: SessionRecord[] = [
  { id: 1, device: "Chrome on Windows", location: "New York, US", time: "Current session", active: true },
  { id: 2, device: "Safari on iPhone", location: "New York, US", time: "2 hours ago", active: false },
];

const initialApiKeys: ApiKeyRecord[] = [
  { id: 1, name: "Instagram Graph API", status: "active", key: "ig-****-****-7f3a", lastUsed: "2 mins ago" },
  { id: 2, name: "TikTok Business API", status: "active", key: "tt-****-****-9b2c", lastUsed: "5 mins ago" },
  { id: 3, name: "YouTube Data API v3", status: "expired", key: "yt-****-****-4d1e", lastUsed: "3 days ago" },
  { id: 4, name: "Facebook Marketing API", status: "rate-limited", key: "fb-****-****-2a8f", lastUsed: "1 hour ago" },
  { id: 5, name: "Snapchat Marketing API", status: "active", key: "sc-****-****-6c4d", lastUsed: "15 mins ago" },
];

interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
}

function ToggleSwitch({ enabled, onToggle, label, description }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0">
      <div>
        <p className="text-[13px] font-medium text-white/90">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground/40 mt-0.5">{description}</p>}
      </div>
      <button onClick={onToggle} className="cursor-pointer relative">
        <div className={cn(
          "w-11 h-6 rounded-full transition-colors duration-200",
          enabled ? "bg-primary" : "bg-white/[0.08]"
        )} style={enabled ? { boxShadow: '0 0 12px rgba(124, 58, 237, 0.3)' } : undefined}>
          <div className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200",
            enabled ? "translate-x-[22px]" : "translate-x-0.5"
          )} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
        </div>
      </button>
    </div>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [saved, setSaved] = useState(false);
  const [sessions, setSessions] = useState(initialSessions);
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Toggle states
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [alertSounds, setAlertSounds] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [viralAlerts, setViralAlerts] = useState(true);
  const [errorAlerts, setErrorAlerts] = useState(true);
  const [twoFA, setTwoFA] = useState(false);
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [aiCaptions, setAiCaptions] = useState(true);
  const [autoRetry, setAutoRetry] = useState(true);
  const [smartTiming, setSmartTiming] = useState(true);

  // Appearance
  const [selectedTheme, setSelectedTheme] = useState('dark');
  const [selectedColor, setSelectedColor] = useState(0);
  const [sidebarMode, setSidebarMode] = useState('expanded');
  const [density, setDensity] = useState('Comfortable');

  const handleSave = () => {
    setSaved(true);
    toast({
      title: 'Settings saved',
      description: `${sections.find((section) => section.id === activeSection)?.label} preferences updated.`,
    });
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    toast({
      title: 'Avatar selected',
      description: `${file.name} is ready to upload.`,
    });
  };

  const handleRevokeSession = (id: number) => {
    setSessions((prev) => prev.filter((session) => session.id !== id));
    toast({
      title: 'Session revoked',
      description: 'The selected device has been signed out.',
    });
  };

  const handleRotateKey = (id: number) => {
    const api = apiKeys.find((entry) => entry.id === id);

    setApiKeys((prev) => prev.map((entry) => {
      if (entry.id !== id) {
        return entry;
      }

      return {
        ...entry,
        status: 'active',
        key: `${entry.key.slice(0, 3)}-****-****-${Math.random().toString(16).slice(2, 6)}`,
        lastUsed: 'Just now',
      };
    }));

    toast({
      title: api?.status === 'expired' ? 'API key renewed' : 'API key rotated',
      description: `${api?.name ?? 'Integration'} credentials were refreshed.`,
    });
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-5">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div className="flex items-center gap-5 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent to-primary p-[2px]">
                <div className="w-full h-full rounded-[14px] bg-background flex items-center justify-center">
                  <User className="w-7 h-7 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Admin User</h3>
                <p className="text-xs text-muted-foreground/50">admin@bviral.io</p>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="text-[11px] text-primary/70 hover:text-primary font-semibold mt-1 cursor-pointer"
                >
                  Change avatar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Display Name</label>
                <input type="text" defaultValue="Admin User" className="input-field" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Email Address</label>
                <input type="email" defaultValue="admin@bviral.io" className="input-field" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Organization</label>
                <input type="text" defaultValue="BViral Media Inc." className="input-field" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Timezone</label>
                <select className="input-field appearance-none cursor-pointer">
                  <option>UTC-5 (Eastern Time)</option>
                  <option>UTC-8 (Pacific Time)</option>
                  <option>UTC+0 (GMT)</option>
                  <option>UTC+1 (CET)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Bio</label>
              <textarea
                defaultValue="Social media automation expert managing 150+ accounts."
                className="input-field h-20 resize-none"
              />
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-5 p-3.5 bg-primary/[0.04] border border-primary/15 rounded-xl">
              <Bell className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground/60">Configure how you receive alerts about your automation pipeline.</p>
            </div>
            <ToggleSwitch enabled={emailNotifs} onToggle={() => setEmailNotifs(!emailNotifs)} label="Email Notifications" description="Receive alerts via email" />
            <ToggleSwitch enabled={pushNotifs} onToggle={() => setPushNotifs(!pushNotifs)} label="Push Notifications" description="Browser and mobile push alerts" />
            <ToggleSwitch enabled={alertSounds} onToggle={() => setAlertSounds(!alertSounds)} label="Alert Sounds" description="Play sound for critical alerts" />
            <ToggleSwitch enabled={weeklyDigest} onToggle={() => setWeeklyDigest(!weeklyDigest)} label="Weekly Performance Digest" description="Summary report every Monday" />
            <ToggleSwitch enabled={viralAlerts} onToggle={() => setViralAlerts(!viralAlerts)} label="Viral Trajectory Alerts" description="Notify when a post goes viral" />
            <ToggleSwitch enabled={errorAlerts} onToggle={() => setErrorAlerts(!errorAlerts)} label="Error & Failure Alerts" description="API errors, token expiry, rate limits" />
          </div>
        );

      case 'security':
        return (
          <div className="space-y-5">
            <div className="p-3.5 bg-amber-500/[0.04] border border-amber-500/15 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-white/80">Security Recommendation</p>
                <p className="text-[11px] text-muted-foreground/40 mt-0.5">Enable two-factor authentication for enhanced account protection.</p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Current Password</label>
              <input type="password" placeholder="••••••••" className="input-field" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">New Password</label>
                <input type="password" placeholder="••••••••" className="input-field" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Confirm Password</label>
                <input type="password" placeholder="••••••••" className="input-field" />
              </div>
            </div>

            <ToggleSwitch enabled={twoFA} onToggle={() => setTwoFA(!twoFA)} label="Two-Factor Authentication" description="Require 2FA for all logins" />

            <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <h4 className="text-xs font-bold text-white/80 mb-3">Active Sessions</h4>
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-3.5 h-3.5 text-muted-foreground/40" />
                      <div>
                        <p className="text-white/70 text-[12px]">{session.device}</p>
                        <p className="text-[10px] text-muted-foreground/30">{session.location} · {session.time}</p>
                      </div>
                    </div>
                    {session.active ? (
                      <span className="text-[9px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/15 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                    ) : (
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        className="text-[10px] text-red-400/70 hover:text-red-400 cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'api-keys':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 bg-accent/[0.04] border border-accent/15 rounded-xl">
              <Key className="w-4 h-4 text-accent shrink-0" />
              <p className="text-xs text-muted-foreground/60">Manage API credentials for platform integrations. Never share these keys.</p>
            </div>

            {apiKeys.map((api) => (
              <div key={api.id} className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-white/[0.08] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    api.status === 'active' ? 'bg-emerald-400' : api.status === 'expired' ? 'bg-red-400' : 'bg-amber-400'
                  )} style={{
                    boxShadow: api.status === 'active' ? '0 0 6px rgba(52, 211, 153, 0.4)' :
                               api.status === 'expired' ? '0 0 6px rgba(239, 68, 68, 0.4)' : '0 0 6px rgba(251, 191, 36, 0.4)'
                  }} />
                  <div>
                    <p className="text-xs font-medium text-white/80">{api.name}</p>
                    <p className="text-[10px] text-muted-foreground/30 font-mono">{api.key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground/30">{api.lastUsed}</span>
                  <button
                    onClick={() => handleRotateKey(api.id)}
                    className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] rounded-lg text-[10px] text-white/60 font-medium transition-colors cursor-pointer"
                  >
                    {api.status === 'expired' ? 'Renew' : 'Rotate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        );

      case 'automation':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-5 p-3.5 bg-primary/[0.04] border border-primary/15 rounded-xl">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground/60">Fine-tune your AI automation pipeline settings.</p>
            </div>
            <ToggleSwitch enabled={autoSchedule} onToggle={() => setAutoSchedule(!autoSchedule)} label="Auto-Schedule Posts" description="AI picks optimal posting times" />
            <ToggleSwitch enabled={aiCaptions} onToggle={() => setAiCaptions(!aiCaptions)} label="AI Caption Generation" description="Auto-generate hashtags and captions" />
            <ToggleSwitch enabled={autoRetry} onToggle={() => setAutoRetry(!autoRetry)} label="Auto-Retry Failed Posts" description="Retry failed uploads up to 3 times" />
            <ToggleSwitch enabled={smartTiming} onToggle={() => setSmartTiming(!smartTiming)} label="Smart Timing Engine" description="Learn best posting times from engagement data" />

            <div className="pt-4 mt-4 border-t border-white/[0.04]">
              <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Global Rate Limit (posts/hour)</label>
              <input
                type="number"
                defaultValue={15}
                className="input-field w-28"
              />
              <p className="text-[10px] text-muted-foreground/30 mt-2">Maximum posts per hour across all accounts. Prevents API throttling.</p>
            </div>

            <div className="pt-4">
              <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Default Video Quality</label>
              <select className="input-field appearance-none cursor-pointer">
                <option>1080p (Recommended)</option>
                <option>720p (Faster processing)</option>
                <option>4K (Premium quality)</option>
              </select>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-3">Theme</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'dark', label: 'Dark', icon: Moon },
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'system', label: 'System', icon: Monitor },
                ].map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all cursor-pointer",
                      selectedTheme === theme.id
                        ? "bg-primary/10 border-primary/25"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                    )}
                    style={selectedTheme === theme.id ? { boxShadow: '0 0 12px rgba(124, 58, 237, 0.1)' } : undefined}
                  >
                    <theme.icon className={cn("w-5 h-5", selectedTheme === theme.id ? "text-primary" : "text-muted-foreground/40")} />
                    <span className={cn("text-[11px] font-medium", selectedTheme === theme.id ? "text-white/80" : "text-muted-foreground/40")}>{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-3">Accent Color</p>
              <div className="flex gap-2.5">
                {[
                  'bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-pink-500', 'bg-amber-500', 'bg-cyan-500',
                ].map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedColor(i)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all hover:scale-110 cursor-pointer",
                      c,
                      selectedColor === i && "ring-2 ring-white ring-offset-2 ring-offset-background scale-110"
                    )}
                    style={selectedColor === i ? { boxShadow: '0 0 15px rgba(255,255,255,0.15)' } : undefined}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-3">Sidebar Mode</p>
              <div className="grid grid-cols-2 gap-3">
                {['expanded', 'collapsed'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSidebarMode(mode)}
                    className={cn(
                      "p-3.5 rounded-xl border text-xs font-medium transition-all cursor-pointer capitalize",
                      sidebarMode === mode
                        ? "bg-primary/10 border-primary/25 text-white/80"
                        : "bg-white/[0.02] border-white/[0.06] text-muted-foreground/40 hover:bg-white/[0.04]"
                    )}
                  >
                    {mode === 'expanded' ? 'Expanded (Default)' : 'Collapsed (Icons only)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-3">Data Density</p>
              <div className="grid grid-cols-3 gap-3">
                {['Compact', 'Comfortable', 'Spacious'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDensity(d)}
                    className={cn(
                      "p-3 rounded-xl border text-[11px] font-medium transition-all cursor-pointer",
                      density === d
                        ? "bg-primary/10 border-primary/25 text-white/80"
                        : "bg-white/[0.02] border-white/[0.06] text-muted-foreground/40 hover:bg-white/[0.04]"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/[0.06]">
            <SettingsIcon className="w-5 h-5 text-white/60" />
          </div>
          <h1 className="page-title mb-0">System Settings</h1>
        </div>
        <p className="page-subtitle ml-[52px]">Configure your automation, security, and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar Navigation */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-2.5 h-fit"
        >
          <nav className="space-y-0.5">
            {sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-white"
                      : "text-muted-foreground/50 hover:bg-white/[0.03] hover:text-white/70"
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    isActive ? "bg-primary/20 text-primary" : "text-muted-foreground/40"
                  )}>
                    <section.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium">{section.label}</p>
                    <p className="text-[9px] text-muted-foreground/30 truncate">{section.description}</p>
                  </div>
                  <ChevronRight className={cn("w-3 h-3 shrink-0 transition-transform text-muted-foreground/20", isActive && "text-primary/50 rotate-90")} />
                </button>
              );
            })}
          </nav>
        </motion.div>

        {/* Content Area */}
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="lg:col-span-3 glass-card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-display font-bold text-white">
                {sections.find(s => s.id === activeSection)?.label}
              </h2>
              <p className="text-xs text-muted-foreground/40 mt-0.5">
                {sections.find(s => s.id === activeSection)?.description}
              </p>
            </div>
          </div>

          {renderSection()}

          {/* Save Button */}
          <div className="flex justify-end mt-8 pt-5 border-t border-white/[0.04]">
            <button
              onClick={handleSave}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-xs font-bold transition-all cursor-pointer",
                saved
                  ? "bg-emerald-500"
                  : "btn-primary"
              )}
              style={saved ? { boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)' } : undefined}
            >
              {saved ? (
                <><CheckCircle2 className="w-4 h-4" /> Saved!</>
              ) : (
                <><Save className="w-4 h-4" /> Save Changes</>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
