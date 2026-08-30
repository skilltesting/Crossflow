import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clipboard, ClipboardCheck, Download, FileUp, Send, UploadCloud, X } from 'lucide-react';
import type { TransferItem } from '../types';
import { formatBytes, formatSpeed } from '../lib/utils';
import { GlassPanel } from './ui/GlassPanel';
import { Button } from './ui/Button';
import { ProgressRing } from './ui/ProgressRing';

interface TransferCenterProps {
  connected: boolean;
  transfers: TransferItem[];
  onSendFile: (file: File) => void;
  onCancelTransfer: (id: string) => void;
  localClipboard: string;
  onLocalClipboardChange: (text: string) => void;
  onSendClipboard: (text: string) => void;
  remoteClipboard: string;
}

export function TransferCenter({
  connected,
  transfers,
  onSendFile,
  onCancelTransfer,
  localClipboard,
  onLocalClipboardChange,
  onSendClipboard,
  remoteClipboard,
}: TransferCenterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [copiedRemote, setCopiedRemote] = useState(false);
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !connected) return;
      Array.from(files).forEach((file) => onSendFile(file));
    },
    [connected, onSendFile]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const readFromDeviceClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onLocalClipboardChange(text);
      setClipboardNotice(null);
    } catch {
      // Browsers require an explicit user gesture + permission for each
      // clipboard read — there's no way to passively "listen" for clipboard
      // changes, so this is a manual pull rather than a background sync.
      setClipboardNotice('Clipboard access was blocked. Allow clipboard permission, or paste manually below.');
    }
  };

  const copyRemoteToDevice = async () => {
    try {
      await navigator.clipboard.writeText(remoteClipboard);
      setCopiedRemote(true);
      window.setTimeout(() => setCopiedRemote(false), 1500);
    } catch {
      setClipboardNotice('Could not write to this device\u2019s clipboard.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <GlassPanel className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">File transfer</h3>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragActive ? 'border-flow-cyan bg-flow-cyan/5' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
          } ${!connected ? 'opacity-50' : ''}`}
        >
          <UploadCloud size={22} className={dragActive ? 'text-flow-cyan' : 'text-white/40'} />
          <p className="text-xs font-medium text-white/70">
            {connected ? 'Drop files here or click to send' : 'Pair a device to enable transfers'}
          </p>
          <p className="text-[11px] text-white/30">Sent directly over your P2P connection — no cloud upload</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            disabled={!connected}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        <div className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {transfers.slice(0, 6).map((t) => {
              const progress = t.size > 0 ? t.transferred / t.size : 0;
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2"
                >
                  <ProgressRing progress={t.status === 'done' ? 1 : progress} tone={t.direction === 'up' ? '#0066FF' : '#00F0FF'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-xs font-medium text-white/85">
                      {t.direction === 'up' ? <FileUp size={12} className="shrink-0 text-white/40" /> : <Download size={12} className="shrink-0 text-white/40" />}
                      <span className="truncate">{t.name}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-white/40">
                      {formatBytes(t.transferred)} / {formatBytes(t.size)}
                      {t.status === 'active' && t.speedBps > 0 && <span> · {formatSpeed(t.speedBps)}</span>}
                      {t.status === 'done' && <span className="text-emerald-300"> · done</span>}
                      {t.status === 'cancelled' && <span className="text-red-300"> · cancelled</span>}
                    </p>
                  </div>
                  {t.status === 'active' && (
                    <button
                      onClick={() => onCancelTransfer(t.id)}
                      className="shrink-0 rounded-lg p-1 text-white/30 hover:bg-white/10 hover:text-white/70"
                      aria-label="Cancel transfer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </GlassPanel>

      {/* Clipboard */}
      <GlassPanel className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Shared clipboard</h3>

        <textarea
          value={localClipboard}
          onChange={(e) => onLocalClipboardChange(e.target.value)}
          placeholder="Type or paste text to sync…"
          rows={3}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/85 placeholder:text-white/25 focus:border-flow-cyan/50 focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={readFromDeviceClipboard} className="flex-1">
            <Clipboard size={13} />
            Pull from device
          </Button>
          <Button size="sm" variant="primary" disabled={!connected || !localClipboard} onClick={() => onSendClipboard(localClipboard)} className="flex-1">
            <Send size={13} />
            Copy to peer
          </Button>
        </div>

        {remoteClipboard && (
          <div className="mt-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-white/35">From peer</p>
            <p className="line-clamp-3 whitespace-pre-wrap break-words text-xs text-white/75">{remoteClipboard}</p>
            <Button size="sm" variant="ghost" onClick={copyRemoteToDevice} className="mt-2 -ml-2 text-white/50 hover:text-white">
              {copiedRemote ? <ClipboardCheck size={13} /> : <Clipboard size={13} />}
              {copiedRemote ? 'Copied' : 'Copy to this device'}
            </Button>
          </div>
        )}

        {clipboardNotice && <p className="mt-2 text-[11px] text-amber-300/80">{clipboardNotice}</p>}
      </GlassPanel>
    </div>
  );
}
