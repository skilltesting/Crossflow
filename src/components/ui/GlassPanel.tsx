import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  glow?: 'blue' | 'cyan' | 'none';
}

export function GlassPanel({ glow = 'none', className, children, ...props }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl shadow-panel',
        glow === 'blue' && 'shadow-glow-blue',
        glow === 'cyan' && 'shadow-glow-cyan',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
