import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Tone = 'blue' | 'cyan' | 'emerald' | 'neutral' | 'red' | 'amber';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  blue: 'bg-flow-blue/15 text-blue-300 border-flow-blue/30',
  cyan: 'bg-flow-cyan/10 text-cyan-200 border-flow-cyan/30',
  emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  neutral: 'bg-white/5 text-white/60 border-white/10',
  red: 'bg-red-500/10 text-red-300 border-red-500/30',
  amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
};

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide',
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
