import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  Expand,
  MonitorUp,
  MonitorX,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
  Gauge,
  ScreenShare,
} from 'lucide-react';
import type { ConnectionState, QualityLevel } from '../types';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { cn } from '../lib/utils';

interface ScreenMirrorProps {
  stream: MediaStream | null;
  isSharingLocally: boolean;
  connectionState: ConnectionState;
  onStartShare: () => Promise<void>;
  onStopShare: () => void;
  onRequestQuality: (level: QualityLevel) => void;
}

const QUALITY_CYCLE: QualityLevel[] = ['auto', 'high', 'medium', 'low'];

export function ScreenMirror({
  stream,
  isSharingLocally,
  connectionState,
  onStartShare,
  onStopShare,
  onRequestQuality,
}: ScreenMirrorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(true);
  const [quality, setQuality] = useState<QualityLevel>('auto');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = muted;
    }
  }, [volume, muted]);

  const handleStart = async () => {
    setError(null);
    setStarting(true);
    try {
      await onStartShare();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start screen sharing.');
    } finally {
      setStarting(false);
    }
  };

  const handleScreenshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const link = document.createElement('a');
    link.download = `crossflow-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current.requestFullscreen().catch(() => {});
  };

  const cycleQuality = () => {
    const next = QUALITY_CYCLE[(QUALITY_CYCLE.indexOf(quality) + 1) % QUALITY_CYCLE.length];
    setQuality(next);
    onRequestQuality(next);
  };

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={containerRef}
      className="group relative flex h-full min-h-[280px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/[0.07] bg-black/40 backdrop-blur-xl"
    >
      {/* ambient corner glows */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-flow-blue/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-flow-cyan/10 blur-3xl" />

      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="h-full w-full object-contain transition-transform duration-300 ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      ) : (
        <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <MonitorX size={24} className="text-white/30" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/70">No screen mirrored yet</p>
            <p className="mx-auto mt-1 max-w-[260px] text-xs text-white/35">
              {connectionState === 'connected'
                ? 'Share this device\u2019s screen, or wait for your paired device to start sharing.'
                : 'Pair a device first, then start mirroring a screen here.'}
            </p>
          </div>
          <Button onClick={handleStart} disabled={starting} variant="primary" size="md">
            <ScreenShare size={16} />
            {starting ? 'Starting…' : 'Start screen share'}
          </Button>
          {error && <p className="max-w-[260px] text-xs text-red-300">{error}</p>}
        </div>
      )}

      {isSharingLocally && (
        <Badge tone="cyan" className="absolute left-3 top-3 z-10">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-flow-cyan" />
          Sharing this screen
        </Badge>
      )}

      {stream && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-2 rounded-xl border border-white/10',
            'bg-obsidian/70 px-3 py-2 backdrop-blur-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100'
          )}
        >
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setRotation((r) => (r + 90) % 360)} aria-label="Rotate">
              <RotateCw size={15} />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleScreenshot} aria-label="Screenshot">
              <Camera size={15} />
            </Button>
            <Button size="icon" variant="ghost" onClick={cycleQuality} aria-label="Toggle quality">
              <Gauge size={15} />
            </Button>
            <span className="hidden text-[10px] uppercase tracking-wide text-white/40 sm:inline">{quality}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 sm:flex">
              <Button size="icon" variant="ghost" onClick={() => setMuted((m) => !m)} aria-label="Mute">
                <VolumeIcon size={15} />
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  if (Number(e.target.value) > 0) setMuted(false);
                }}
                className="crossflow-slider w-20"
                aria-label="Volume"
              />
            </div>
            <Button size="icon" variant="ghost" onClick={handleFullscreen} aria-label="Fullscreen">
              <Expand size={15} />
            </Button>
            {isSharingLocally && (
              <Button size="sm" variant="danger" onClick={onStopShare}>
                <MonitorUp size={14} />
                Stop
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
