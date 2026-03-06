import { useState, type ReactNode } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { PixelAgentPanel } from './PixelAgentPanel';

interface PixelAgentDrawerProps {
  enabled: boolean;
  taskActivity: Record<string, 'busy' | 'idle' | 'waiting'>;
  activeTaskIds: string[];
  children: ReactNode;
}

export function PixelAgentDrawer({
  enabled,
  taskActivity,
  activeTaskIds,
  children,
}: PixelAgentDrawerProps) {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('pixelAgentsCollapsed') === 'true';
  });

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <PanelGroup direction="vertical" className="h-full">
      <Panel minSize={20}>{children}</Panel>
      <PanelResizeHandle className="h-[1px] bg-border/40" />
      <Panel
        defaultSize={collapsed ? 4 : 30}
        minSize={10}
        maxSize={50}
        collapsible
        collapsedSize={4}
        onCollapse={() => {
          setCollapsed(true);
          localStorage.setItem('pixelAgentsCollapsed', 'true');
        }}
        onExpand={() => {
          setCollapsed(false);
          localStorage.setItem('pixelAgentsCollapsed', 'false');
        }}
      >
        {collapsed ? (
          <div
            className="h-full flex items-center justify-center text-[11px] text-foreground/40 select-none cursor-default"
            style={{ background: '#1a1a2e' }}
          >
            Pixel Agents
          </div>
        ) : (
          <PixelAgentPanel taskActivity={taskActivity} activeTaskIds={activeTaskIds} />
        )}
      </Panel>
    </PanelGroup>
  );
}
