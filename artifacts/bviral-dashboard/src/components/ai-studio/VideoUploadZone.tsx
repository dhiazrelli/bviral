import React, { useMemo, useRef } from 'react';
import { Upload, RefreshCcw, Film, Loader2, Check, X, Captions } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListVideosQueryKey,
  useUploadVideo,
  type Video,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VideoUploadZoneProps {
  selectedVideo: Video | null;
  onUploaded: (video: Video) => void;
  /** When set, the captioned preview is played instead of the source video. */
  captionPreviewUrl?: string | null;
  onApproveCaption?: () => void;
  onDiscardCaption?: () => void;
  isApprovingCaption?: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || Number.isNaN(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function statusTone(status: string): string {
  switch (status) {
    case 'ready':
    case 'done':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'processing':
    case 'queued':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'failed':
      return 'border-red-500/30 bg-red-500/10 text-red-300';
    default:
      return 'border-white/[0.1] bg-white/[0.05] text-white/70';
  }
}

export function VideoUploadZone({
  selectedVideo,
  onUploaded,
  captionPreviewUrl,
  onApproveCaption,
  onDiscardCaption,
  isApprovingCaption,
}: VideoUploadZoneProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadMutation = useUploadVideo({
    mutation: {
      onSuccess: async (video) => {
        await queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
        onUploaded(video);
        toast({
          title: 'Video uploaded',
          description: 'Running virality analysis automatically.',
        });
      },
      onError: async (error) => {
        // The API returns 409 with { existing: Video } when the file content
        // is already in the user's library. Treat that as "open existing"
        // instead of a hard error.
        const apiError = error as { status?: number; data?: { existing?: Video } };
        if (apiError.status === 409 && apiError.data?.existing) {
          await queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
          onUploaded(apiError.data.existing);
          toast({
            title: 'Already in your library',
            description: 'Opened the existing copy of this video.',
          });
          return;
        }

        toast({
          title: 'Upload failed',
          description: error instanceof Error ? error.message : 'Unable to upload video.',
          variant: 'destructive',
        });
      },
    },
  });

  const isCaptionPreview = Boolean(captionPreviewUrl);
  const previewUrl = useMemo(() => {
    if (captionPreviewUrl) return captionPreviewUrl;
    if (!selectedVideo) return null;
    return selectedVideo.processedUrl || selectedVideo.originalUrl;
  }, [captionPreviewUrl, selectedVideo]);

  const triggerFilePicker = () => fileInputRef.current?.click();

  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="video/mp4,video/quicktime"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        uploadMutation.mutate({ data: { file } });
        event.target.value = '';
      }}
    />
  );

  if (!selectedVideo) {
    return (
      <div className="glass-card p-6">
        {hiddenInput}
        <div
          onClick={triggerFilePicker}
          className="border-2 border-dashed border-white/[0.08] hover:border-primary/30 transition-all duration-300 rounded-2xl bg-white/[0.01] p-8 flex flex-col items-center justify-center text-center cursor-pointer group hover:bg-primary/[0.02]"
        >
          <div
            className="w-14 h-14 bg-primary/15 text-primary rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border border-primary/15"
            style={{ boxShadow: '0 0 25px rgba(124, 58, 237, 0.15)' }}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-white/90 font-bold text-sm mb-1">
            {uploadMutation.isPending ? 'Uploading…' : 'Click to upload raw footage'}
          </h3>
          <p className="text-muted-foreground/40 text-xs">MP4 or MOV uploads to Supabase Storage</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      {hiddenInput}
      <div className="flex flex-col gap-3">
        <div className={cn(
          'relative w-full overflow-hidden rounded-xl border bg-black/60 aspect-video',
          isCaptionPreview ? 'border-primary/40' : 'border-white/[0.06]',
        )}>
          {previewUrl ? (
            <video
              key={previewUrl}
              src={previewUrl}
              controls
              autoPlay={isCaptionPreview}
              playsInline
              preload="metadata"
              className="h-full w-full object-contain bg-black"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/40 text-xs">
              <Film className="mr-2 h-4 w-4" /> Preview not available yet
            </div>
          )}
          {isCaptionPreview && (
            <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary backdrop-blur-sm">
              <Captions className="h-3 w-3" /> Captioned preview
            </div>
          )}
        </div>

        {isCaptionPreview && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2.5">
            <p className="text-xs text-white/75">
              This captioned version isn't saved yet. Approve to keep it (the raw original stays recoverable), or discard.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onDiscardCaption}
                disabled={isApprovingCaption}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.08] disabled:opacity-50 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" /> Discard
              </button>
              <button
                type="button"
                onClick={onApproveCaption}
                disabled={isApprovingCaption}
                className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-50"
              >
                {isApprovingCaption ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {isApprovingCaption ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <Film className="w-3.5 h-3.5 text-primary shrink-0" />
              <h3 className="truncate text-sm font-bold text-white/90">
                {selectedVideo.originalFilename || `Video ${selectedVideo.id.slice(0, 8)}`}
              </h3>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/50">
              <span>{formatDuration(selectedVideo.duration)}</span>
              <span>·</span>
              <span
                className={`rounded-full border px-1.5 py-0.5 font-semibold uppercase tracking-wider ${statusTone(selectedVideo.status)}`}
              >
                {selectedVideo.status}
              </span>
              <span>·</span>
              <span className="font-mono">{selectedVideo.id.slice(0, 8)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={triggerFilePicker}
            disabled={uploadMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.14] transition-colors px-3 py-2 text-xs font-semibold text-white/80 disabled:opacity-50 cursor-pointer"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="w-3.5 h-3.5" />
            )}
            {uploadMutation.isPending ? 'Uploading…' : 'Replace'}
          </button>
        </div>
      </div>
    </div>
  );
}
