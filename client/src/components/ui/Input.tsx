import type { InputHTMLAttributes } from 'react';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder:text-latte focus:border-coral focus:outline-none ${className}`}
      {...props}
    />
  );
}
