import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Clipboard, FileText, Info, Wifi, Trash2 } from 'lucide-react';
import type { ActivityItem, ActivityKind } from '../types';
import { formatRelativeTime } from '../lib/utils';
import { GlassPanel } from './ui/GlassPanel';
import { Button } from './ui/Button';

const ICONS: Record<ActivityKind, typeof Bell> = {
  connection: Wifi,
  clipboard: Clipboard,
  file: FileText,
  notification: Bell,
  system: Info,
};

const TONES: Record<ActivityKind, string> = {
  connection: 'text-flow-cyan bg-flow-cyan/10',
  clipboard: 'text-flow-blue bg-flow-blue/10',
  file: 'text-emerald-300 bg-emerald-500/10',
  notification: 'text-amber-300 bg-amber-500/10',
  system: 'text-white/50 bg-white/5',
};

interface ActivityFeedProps {
  items: ActivityItem[];
  onClear: () => void;
}

export function ActivityFeed({ items, onClear }: ActivityFeedProps) {
  return (
    <GlassPanel className="flex h-full min-h-0 flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Live activity</h3>
        {items.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onClear} className="text-white/40 hover:text-white/80">
            <Trash2 size={13} />
            Clear
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
        {items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-white/30">
            <Info size={22} />
            <p className="max-w-[220px] text-xs">Synced notifications, clipboard events and transfers will show up here.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="flex items-start gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONES[item.kind]}`}>
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white/90">{item.title}</p>
                  {item.detail && <p className="mt-0.5 line-clamp-2 text-xs text-white/45">{item.detail}</p>}
                </div>
                <span className="shrink-0 whitespace-nowrap pt-0.5 text-[10px] text-white/30">
                  {formatRelativeTime(item.timestamp)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </GlassPanel>
  );
}
