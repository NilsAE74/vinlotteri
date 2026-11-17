'use client';

import { useFormStatus } from 'react-dom';

// Submit-knapp som låses mens skjemaet sendes (sperre mot dobbeltklikk)
export default function PendingSubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ''} disabled:opacity-60 disabled:cursor-wait`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
