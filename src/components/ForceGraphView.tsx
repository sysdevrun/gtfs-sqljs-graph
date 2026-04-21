import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphPayload } from '../types';

interface Props {
  payload: GraphPayload;
}

interface FGNode {
  id: string;
  label: string;
}
interface FGLink {
  source: string;
  target: string;
  color: string;
  width: number;
  tripCount: number;
}

export function ForceGraphView({ payload }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  const data = useMemo(() => {
    const nodes: FGNode[] = payload.nodes.map((n) => ({ id: n.id, label: n.label }));
    const links: FGLink[] = payload.links.map((l) => ({
      source: l.source,
      target: l.target,
      color: l.color ?? '#64748b',
      width: Math.max(1, Math.min(6, 1 + Math.log2(l.trips.length + 1))),
      tripCount: l.trips.length,
    }));
    return { nodes, links };
  }, [payload]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
    >
      <div className="absolute left-3 top-3 z-10 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-zinc-300">
        react-force-graph-2d · force-directed
      </div>
      {size.width > 0 && size.height > 0 ? (
        <ForceGraph2D
          width={size.width}
          height={size.height}
          graphData={data}
          backgroundColor="#0b0d12"
          nodeRelSize={3}
          nodeLabel={(n) => (n as FGNode).label}
          nodeColor={() => '#e2e8f0'}
          linkColor={(l) => (l as FGLink).color}
          linkWidth={(l) => (l as FGLink).width}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={(l) => (l as FGLink).color}
          cooldownTicks={100}
        />
      ) : null}
    </div>
  );
}
