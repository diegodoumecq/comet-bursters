import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from 'react-resizable-panels';

export function ResizablePanelGroup({ className = '', ...props }: GroupProps) {
  return <Group className={className} {...props} />;
}

export function ResizablePanel({ className = '', ...props }: PanelProps) {
  return <Panel className={className} {...props} />;
}

export function ResizableHandle({
  className = '',
  withHandle = false,
  ...props
}: SeparatorProps & { withHandle?: boolean }) {
  return (
    <Separator
      className={`relative flex w-2 shrink-0 items-stretch justify-center bg-slate-900/50 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${className}`.trim()}
      {...props}
    >
      <div className="w-px bg-slate-700/80" />
      {withHandle ? (
        <div className="pointer-events-none absolute inset-y-0 flex items-center justify-center">
          <div className="flex h-10 w-4 items-center justify-center rounded-full border border-slate-700 bg-slate-950/90">
            <div className="grid gap-1">
              <span className="block h-1 w-1 rounded-full bg-slate-500" />
              <span className="block h-1 w-1 rounded-full bg-slate-500" />
              <span className="block h-1 w-1 rounded-full bg-slate-500" />
            </div>
          </div>
        </div>
      ) : null}
    </Separator>
  );
}
