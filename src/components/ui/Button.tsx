import { forwardRef, useRef, useState, type ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  magnetic?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-gradient-to-br from-flow-blue to-[#0047B3] text-white shadow-glow-blue hover:brightness-110 border border-white/10',
  outline: 'bg-white/[0.02] border border-white/10 text-white/90 hover:bg-white/[0.06] hover:border-white/20',
  ghost: 'bg-transparent text-white/70 hover:text-white hover:bg-white/[0.06]',
  danger: 'bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', magnetic = true, children, ...props }, forwardedRef) => {
    const innerRef = useRef<HTMLButtonElement | null>(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!magnetic || !innerRef.current) return;
      const rect = innerRef.current.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      setOffset({ x: relX * 0.18, y: relY * 0.28 });
    };

    const handleMouseLeave = () => setOffset({ x: 0, y: 0 });

    return (
      <motion.button
        ref={(node) => {
          innerRef.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        animate={{ x: offset.x, y: offset.y }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18, mass: 0.4 }}
        className={cn(
          'relative inline-flex items-center justify-center font-medium tracking-tight transition-colors',
          'disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className
        )}
        {...(props as any)}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

