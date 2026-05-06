import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Sparkles, Type, Crop, Maximize, Scissors, Mic, Music, 
  Film, Image as ImageIcon, Play, Download, Wand2, Plus,
  Upload, Layers, ExternalLink, RefreshCcw, MonitorPlay
} from 'lucide-react';
import {
  getListVideosQueryKey,
  useListVideos,
  useUploadVideo,
} from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const tools = [
  { id: 'captions', label: 'AI Captions', icon: Type, active: true },
  { id: 'subtitles', label: 'AI Subtitles', icon: Type, active: false },
  { id: 'autocrop', label: 'AI Auto Crop', icon: Crop, active: true },
  { id: 'aspect', label: 'Aspect Ratio', icon: Maximize, active: false },
  { id: 'moments', label: 'Best Moments', icon: Sparkles, active: true },
  { id: 'zoom', label: 'Auto Zoom', icon: ImageIcon, active: false },
  { id: 'voice', label: 'AI Voice Over', icon: Mic, active: false },
  { id: 'trim', label: 'Smart Trim', icon: Scissors, active: true },
  { id: 'intros', label: 'Intros/Outros', icon: Film, active: false },
  { id: 'music', label: 'Music Manager', icon: Music, active: true },
];

export default function AiVideoStudio() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videosQuery = useListVideos();
  const uploadVideoMutation = useUploadVideo({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
        toast({
          title: 'Video uploaded',
          description: 'The upload is saved and queued for processing.',
        });
      },
      onError: (error) => {
        toast({
          title: 'Upload failed',
          description: error instanceof Error ? error.message : 'Unable to upload video.',
          variant: 'destructive',
        });
      },
    },
  });
  const [activeTools, setActiveTools] = useState<Record<string, boolean>>(
    tools.reduce((acc, tool) => ({ ...acc, [tool.id]: tool.active }), {})
  );
  const [prompt, setPrompt] = useState("");
  const [styleTemplate, setStyleTemplate] = useState("Fast Paced Tech");
  const [voiceModel, setVoiceModel] = useState("Energetic Male (Adam)");
  const [uploadedAsset, setUploadedAsset] = useState<string | null>(null);
  const [isTimelinePlaying, setTimelinePlaying] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<'ai' | 'editor'>('ai');
  const [editorFrameKey, setEditorFrameKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videos = videosQuery.data?.data ?? [];
  const videoEditorUrl = import.meta.env.VITE_BVIRAL_VIDEO_EDITOR_URL ?? 'http://localhost:3000/projects';

  const toggleTool = (id: string) => {
    setActiveTools(prev => {
      const next = !prev[id];
      const tool = tools.find((entry) => entry.id === id);

      toast({
        title: next ? `${tool?.label} enabled` : `${tool?.label} disabled`,
        description: next ? 'The processor will apply this step to new renders.' : 'This step is excluded from the current run.',
      });

      return { ...prev, [id]: next };
    });
  };

  const handleGenerate = () => {
    if (!prompt) return;
    toast({
      title: 'Generation API not connected',
      description: `${styleTemplate} with ${voiceModel} is ready for the generation endpoint when it exists.`,
    });
  };

  const handleLaunchVideoEditor = () => {
    window.open(videoEditorUrl, '_blank', 'noopener,noreferrer');
    toast({
      title: 'BVIRAL Video Editor launched',
      description: 'The editor opened in a separate browser tab.',
    });
  };

  const activeCount = Object.values(activeTools).filter(Boolean).length;

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="glass-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/12 text-primary">
            {workspaceMode === 'editor' ? <MonitorPlay className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-display font-bold text-white">
              {workspaceMode === 'editor' ? 'BVIRAL Video Editor' : 'AI Studio Pipeline'}
            </h2>
            <p className="truncate text-xs text-muted-foreground/55">
              {workspaceMode === 'editor'
                ? 'Full browser editor for manual timeline work and exports.'
                : 'Upload, enhance, and generate short-form video variants.'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.06] bg-black/20 p-1">
          <button
            onClick={() => setWorkspaceMode('ai')}
            className={cn(
              'flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition',
              workspaceMode === 'ai'
                ? 'bg-primary/18 text-white shadow-[0_0_20px_rgba(124,58,237,0.12)]'
                : 'text-white/52 hover:bg-white/[0.04] hover:text-white/80',
            )}
          >
            <Wand2 className="h-4 w-4" />
            AI Tools
          </button>
          <button
            onClick={() => setWorkspaceMode('editor')}
            className={cn(
              'flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition',
              workspaceMode === 'editor'
                ? 'bg-primary/18 text-white shadow-[0_0_20px_rgba(124,58,237,0.12)]'
                : 'text-white/52 hover:bg-white/[0.04] hover:text-white/80',
            )}
          >
            <MonitorPlay className="h-4 w-4" />
            Editor
          </button>
        </div>
      </div>

      {workspaceMode === 'editor' ? (
        <div className="glass-card flex min-h-[760px] flex-1 flex-col overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="surface-label mb-2">
                <Layers className="h-3.5 w-3.5 text-primary" />
                BVIRAL
              </div>
              <h3 className="truncate text-lg font-display font-bold text-white">BVIRAL Video Editor</h3>
              <p className="truncate text-xs text-muted-foreground/55">{videoEditorUrl}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setEditorFrameKey((value) => value + 1)}
                className="flex min-h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-white/72 transition hover:bg-white/[0.07] hover:text-white"
                aria-label="Reload BVIRAL Video Editor"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
              <button
                onClick={handleLaunchVideoEditor}
                className="btn-accent flex min-h-10 items-center justify-center gap-2 px-4"
              >
                <ExternalLink className="h-4 w-4" />
                Launch
              </button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 bg-slate-950">
            <iframe
              key={editorFrameKey}
              src={videoEditorUrl}
              title="BVIRAL Video Editor"
              className="h-full min-h-[690px] w-full border-0 bg-slate-950"
              allow="clipboard-read; clipboard-write; fullscreen"
              referrerPolicy="no-referrer"
              sandbox="allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 lg:flex-row">
      
      {/* LEFT PANEL: Upload & Enhance */}
      <div className="w-full lg:w-[58%] flex flex-col gap-4">
        <div className="glass-card p-6 flex flex-col flex-1">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center border border-primary/10">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white">Enhance Engine</h2>
                <p className="text-muted-foreground/60 text-xs">Upload raw footage and let AI optimize for all platforms.</p>
              </div>
            </div>
          </div>

          {/* Upload Area */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }

              setUploadedAsset(file.name);
              uploadVideoMutation.mutate({ data: { file } });
            }}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/[0.08] hover:border-primary/30 transition-all duration-300 rounded-2xl bg-white/[0.01] p-8 flex flex-col items-center justify-center text-center cursor-pointer mb-6 group hover:bg-primary/[0.02]"
          >
            <div className="w-14 h-14 bg-primary/15 text-primary rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border border-primary/15"
              style={{ boxShadow: '0 0 25px rgba(124, 58, 237, 0.15)' }}>
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-white/90 font-bold text-sm mb-1">
              {uploadVideoMutation.isPending ? 'Uploading...' : uploadedAsset ? uploadedAsset : 'Click to upload raw footage'}
            </h3>
            <p className="text-muted-foreground/40 text-xs">
              {uploadedAsset ? 'Click to replace the source file' : 'MP4 or MOV uploads to Supabase Storage'}
            </p>
          </div>

          {/* Tools Grid */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">AI Processing Pipeline</h3>
            <span className="text-[10px] text-primary/70 font-semibold">{activeCount}/{tools.length} active</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 mb-6">
            {tools.map((tool) => {
              const isActive = activeTools[tool.id];
              return (
                <button
                  key={tool.id}
                  onClick={() => toggleTool(tool.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all duration-200 relative overflow-hidden group cursor-pointer",
                    isActive 
                      ? "bg-primary/10 border-primary/25" 
                      : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]"
                  )}
                  style={isActive ? { boxShadow: '0 0 15px rgba(124, 58, 237, 0.08)' } : undefined}
                >
                  <tool.icon className={cn("w-4 h-4 transition-colors", isActive ? "text-primary" : "text-muted-foreground/50")} />
                  <span className={cn("text-[10px] font-medium text-center leading-tight", isActive ? "text-white/80" : "text-muted-foreground/50")}>{tool.label}</span>
                </button>
              );
            })}
          </div>

          {/* Timeline */}
          <div className="mt-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">Timeline Preview</h3>
              <button
                onClick={() => {
                  setTimelinePlaying((prev) => {
                    const next = !prev;
                    toast({
                      title: next ? 'Timeline playback started' : 'Timeline playback paused',
                      description: uploadedAsset ?? 'Using the current preview timeline.',
                    });
                    return next;
                  });
                }}
                className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors cursor-pointer border border-white/[0.06]"
              >
                <Play className="w-3 h-3 text-white ml-0.5" />
              </button>
            </div>
            <div className="bg-black/30 border border-white/[0.06] rounded-xl p-3 overflow-hidden relative">
              {/* Scrubber */}
              <div className="absolute top-0 bottom-0 left-[30%] w-px bg-red-500 z-10" style={{ boxShadow: '0 0 6px rgba(239, 68, 68, 0.5)' }}>
                <div className="w-2.5 h-2.5 bg-red-500 rounded-sm absolute -top-1 -left-1" style={{ boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)' }}></div>
              </div>
              
              <div className="space-y-1.5">
                <div className="h-7 bg-white/[0.03] rounded flex overflow-hidden">
                  <div className="w-[80%] h-full bg-indigo-500/25 border border-indigo-500/30 rounded-l mx-0.5"></div>
                </div>
                <div className="h-7 bg-white/[0.03] rounded flex overflow-hidden">
                  <div className="w-[30%] h-full bg-emerald-500/25 border border-emerald-500/30 rounded mx-0.5 ml-[10%]"></div>
                  <div className="w-[40%] h-full bg-emerald-500/25 border border-emerald-500/30 rounded mx-0.5"></div>
                </div>
                <div className="h-5 bg-white/[0.03] rounded flex items-center px-2 gap-1 overflow-hidden">
                  {[...Array(6)].map((_,i) => <div key={i} className="w-10 h-1.5 bg-primary/40 rounded-full"></div>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Generate Video */}
      <div className="w-full lg:w-[42%] glass-card p-6 flex flex-col relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-accent/15 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="mb-6 relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-primary/10 flex items-center justify-center border border-accent/10">
              <Wand2 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-white">Generate From Scratch</h2>
              <p className="text-muted-foreground/60 text-xs">Text-to-Video specialized for Shorts/Reels.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 flex-1 relative z-10">
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Prompt</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Generate a viral 15s short about 5 top AI tools for 2024, energetic pacing..."
              className="input-field h-28 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Style Template</label>
              <select
                value={styleTemplate}
                onChange={(e) => setStyleTemplate(e.target.value)}
                className="input-field appearance-none cursor-pointer py-2.5"
              >
                <option>Fast Paced Tech</option>
                <option>Aesthetic Vlog</option>
                <option>Listicle/Top 5</option>
                <option>Faceless Motivation</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">Voice Model</label>
              <select
                value={voiceModel}
                onChange={(e) => setVoiceModel(e.target.value)}
                className="input-field appearance-none cursor-pointer py-2.5"
              >
                <option>Energetic Male (Adam)</option>
                <option>Professional Female (Sarah)</option>
                <option>Hyped Creator (Josh)</option>
              </select>
            </div>
          </div>

          <button 
            onClick={handleGenerate}
            disabled={!prompt}
            className="w-full py-3.5 mt-2 btn-accent flex items-center justify-center gap-2 text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            <><Sparkles className="w-5 h-5" /> Prepare Generation</>
          </button>

          {/* Result Area */}
          <div className="pt-4 mt-4 border-t border-white/[0.06]">
            <h3 className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-3">Uploaded Videos</h3>
            {videosQuery.isLoading && (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="aspect-[9/16] bg-white/[0.04] border border-white/[0.06] rounded-xl animate-pulse" />
                ))}
              </div>
            )}
            {videosQuery.isError && (
              <div className="rounded-xl border border-red-500/15 bg-red-500/8 p-4">
                <p className="text-sm font-semibold text-red-300">Unable to load videos</p>
                <button onClick={() => videosQuery.refetch()} className="mt-3 text-xs font-semibold text-white/70 hover:text-white">
                  Retry
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {!videosQuery.isLoading && !videosQuery.isError && videos.slice(0, 4).map((video) => (
                <div key={video.id} className="aspect-[9/16] bg-black/40 border border-white/[0.06] rounded-xl relative overflow-hidden group cursor-pointer">
                  {/* Subtle gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                    <span className="text-[10px] text-white/70 font-medium">{video.status} · {video.id.slice(0, 8)}</span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-all duration-300 backdrop-blur-sm gap-2">
                    <button
                      onClick={() => {
                        setPreviewingId(video.id);
                        toast({
                          title: 'Preview opened',
                          description: `Video ${video.id.slice(0, 8)} is now in focus.`,
                        });
                      }}
                      className="p-2 bg-primary/80 rounded-full text-white hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                    <button
                      onClick={() => toast({
                        title: 'Download queued',
                        description: 'Use the stored video URL for export.',
                      })}
                      className="p-2 bg-white/15 rounded-full text-white hover:bg-white/25 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {previewingId === video.id ? (
                    <div className="absolute left-3 top-3 rounded-full border border-primary/30 bg-primary/18 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
                      Previewing
                    </div>
                  ) : null}
                </div>
              ))}
              {!videosQuery.isLoading && !videosQuery.isError && videos.length === 0 && (
                <div className="col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 text-center">
                  <p className="text-sm text-white/60">No uploaded videos yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground/40">Upload footage to populate this panel from the API.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

        </div>
      )}
    </div>
  );
}
