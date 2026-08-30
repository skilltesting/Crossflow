import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export function Slider({ className, ...props }: SliderProps) {
  return <input type="range" className={cn('crossflow-slider', className)} {...props} />;
}
