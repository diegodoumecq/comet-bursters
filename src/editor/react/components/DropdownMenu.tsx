import { useRef } from 'react';

import { useOnClickOutside } from '../hooks/useOnClickOutside';

export function DropdownMenu({
  align = 'right',
  children,
  isOpen,
  menuClassName = '',
  onClose,
  onToggle,
  trigger,
}: {
  align?: 'left' | 'right';
  children: React.ReactNode;
  isOpen: boolean;
  menuClassName?: string;
  onClose: () => void;
  onToggle: () => void;
  trigger: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useOnClickOutside({
    enabled: isOpen,
    onClickOutside: onClose,
    ref: rootRef,
  });

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={onToggle}>
        {trigger}
      </button>
      {isOpen ? (
        <div
          className={`absolute top-10 z-20 min-w-32 border border-slate-700 bg-slate-950 p-1 shadow-xl ${
            align === 'left' ? 'left-0' : 'right-0'
          } ${menuClassName}`.trim()}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
