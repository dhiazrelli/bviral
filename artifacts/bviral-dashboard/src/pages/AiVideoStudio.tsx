import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Type, Crop, Maximize, Scissors, Mic, Music, 
  Film, Image as ImageIcon, Play, Download, Wand2, Plus,
  Upload, Layers
} from 'lucide-react';
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
  const [activeTools, setActiveTools] = useState<Record<string, boolean>>(
    tools.reduce((acc, tool) => ({ ...acc, [tool.id]: tool.active }), {})
  );
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [styleTemplate, setStyleTemplate] = useState("Fast Paced Tech");
  const [voiceModel, setVoiceModel] = useState("Energetic Male (Adam)");
  const [uploadedAsset, setUploadedAsset] = useState<string | null>(null);
  const [isTimelinePlaying, setTimelinePlaying] = useState(false);
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const [recentGenerations, setRecentGenerations] = useState([
    { id: 1, label: "Variation 1" },
    { id: 2, label: "Variation 2" },
  ]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if(!prompt) return;
    setIsGenerating(true);
    toast({
      title: 'Generation started',
      description: `${styleTemplate} with ${voiceModel} is entering the render queue.`,
    });
    setTimeout(() => {
      setIsGenerating(false);
      setRecentGenerations(prev => [
        { id: Date.now(), label: `Variation ${prev.length + 1}` },
        ...prev,
      ].slice(0, 4));
      toast({
        title: 'Variations ready',
        description: 'New renders were added to Recent Generations.',
      });
    }, 3000);
  };

  const activeCount = Object.values(activeTools).filter(Boolean).length;

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4">
      
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
              toast({
                title: 'Footage loaded',
                description: `${file.name} is staged for enhancement.`,
              });
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
              {uploadedAsset ? uploadedAsset : 'Drag & drop raw footage'}
            </h3>
            <p className="text-muted-foreground/40 text-xs">
              {uploadedAsset ? 'Click to replace the staged source file' : 'MP4, MOV up to 2GB'}
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
            disabled={!prompt || isGenerating}
            className="w-full py-3.5 mt-2 btn-accent flex items-center justify-center gap-2 text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isGenerating ? (
              <><span className="animate-spin"><Wand2 className="w-5 h-5" /></span> Generating...</>
            ) : (
              <><Sparkles className="w-5 h-5" /> Generate Variations</>
            )}
          </button>

          {/* Result Area */}
          <div className="pt-4 mt-4 border-t border-white/[0.06]">
            <h3 className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-3">Recent Generations</h3>
            <div className="grid grid-cols-2 gap-3">
              {recentGenerations.map((generation) => (
                <div key={generation.id} className="aspect-[9/16] bg-black/40 border border-white/[0.06] rounded-xl relative overflow-hidden group cursor-pointer">
                  {/* Subtle gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                    <span className="text-[10px] text-white/70 font-medium">{generation.label}</span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-all duration-300 backdrop-blur-sm gap-2">
                    <button
                      onClick={() => {
                        setPreviewingId(generation.id);
                        toast({
                          title: 'Preview opened',
                          description: `${generation.label} is now in focus.`,
                        });
                      }}
                      className="p-2 bg-primary/80 rounded-full text-white hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                    <button
                      onClick={() => toast({
                        title: 'Download queued',
                        description: `${generation.label} is being prepared for export.`,
                      })}
                      className="p-2 bg-white/15 rounded-full text-white hover:bg-white/25 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {previewingId === generation.id ? (
                    <div className="absolute left-3 top-3 rounded-full border border-primary/30 bg-primary/18 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
                      Previewing
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
