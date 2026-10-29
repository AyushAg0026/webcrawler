import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Joins class names and lets later Tailwind classes win over earlier ones:
// cn('p-2 text-sm', isLarge && 'p-4') -> 'text-sm p-4'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
