import { motion } from 'framer-motion';
import { QrCode, Settings, Radio } from 'lucide-react';
import type { ConnectionState, PeerRole, PeerStats } from '../types';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { cn } from '../lib/utils';

interface TopNavProps {
  connectionState: ConnectionState;
  role: PeerRole;
  stats: PeerStats;
  onOpenPairing: () => void;
  onOpenSettings: () => void;
}

const STATE_LABEL: Record<ConnectionState, string> = {
  idle: 'Not paired',
  gathering: 'Preparing code…',
  'awaiting-answer': 'Waiting for scan…',
  connecting: 'Connecting…',
  connected: 'P2P connected',
  disconnected: 'Disconnected',
  failed: 'Connection failed',
};

const STATE_TONE: Record<ConnectionState, 'emerald' | 'blue' | 'amber' | 'neutral' | 'red'> = {
  idle: 'neutral',
  gathering: 'blue',
  'awaiting-answer': 'blue',
  connecting: 'amber',
  connected: 'emerald',
  disconnected: 'neutral',
  failed: 'red',
};

function SignalBars({ strength }: { strength: 0 | 1 | 2 | 3 }) {
  return (
    <div className="flex items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn('w-[3px] rounded-sm bg-white/15', strength > i && 'bg-flow-cyan')}
          style={{ height: 4 + i * 3 }}
        />
      ))}
    </div>
  );
}

export function TopNav({ connectionState, role, stats, onOpenPairing, onOpenSettings }: TopNavProps) {
  const connected = connectionState === 'connected';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-obsidian/70 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-2.5">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-flow-cyan to-flow-blue shadow-glow-cyan">
          <Radio size={16} className="text-obsidian" strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-white">
          Cross<span className="text-flow-cyan">Flow</span>
        </span>
        {role === 'loopback' && (
          <Badge tone="amber" className="hidden sm:inline-flex">
            Demo mode
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Badge tone={STATE_TONE[connectionState]} className="gap-2">
          <motion.span
            className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-flow-cyan' : 'bg-white/30')}
            animate={connected ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] } : {}}
            transition={{ duration: 1.6, repeat: connected ? Infinity : 0 }}
          />
          <span className="hidden sm:inline">{STATE_LABEL[connectionState]}</span>
        </Badge>

        {connected && (
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/60 sm:flex">
            <SignalBars strength={stats.signalStrength} />
            <span className="font-mono">{stats.latencyMs ?? '--'} ms</span>
          </div>
        )}

        <Button size="icon" variant="outline" onClick={onOpenPairing} aria-label="Pair a device">
          <QrCode size={17} />
        </Button>
        <Button size="icon" variant="ghost" onClick={onOpenSettings} aria-label="Settings">
          <Settings size={17} />
        </Button>
      </div>
    </header>
  );
}
