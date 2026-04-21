import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import {
  forceRadial,
  forceX,
  forceY,
  forceCollide,
  forceManyBody,
  forceLink,
} from 'd3-force';
import type { GraphPayload } from '../types';

type ForceMode =
  | 'default'
  | 'spread'
  | 'compact'
  | 'radial-degree'
  | 'geographic'
  | 'clustered-route';

const MODE_LABELS: Record<ForceMode, string> = {
  default: 'Default force-directed',
  spread: 'Spread out',
  compact: 'Compact',
  'radial-degree': 'Radial by degree',
  geographic: 'Geographic (pinned)',
  'clustered-route': 'Clustered by route',
};

interface Props {
  payload: GraphPayload;
}

interface FGNode {
  id: string;
  label: string;
  lat: number | null;
  lon: number | null;
  degree: number;
  routeIds: string[];
  fx?: number;
  fy?: number;
}

interface FGLink {
  source: string;
  target: string;
  color: string;
  width: number;
  tripCount: number;
}

function hasCoords(payload: GraphPayload): boolean {
  return (
    payload.nodes.length > 0 &&
    payload.nodes.every((n) => n.lat != null && n.lon != null)
  );
}

export function ForceGraphView({ payload }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const geographic = useMemo(() => hasCoords(payload), [payload]);
  const [mode, setMode] = useState<ForceMode>('default');

  useEffect(() => {
    if (mode === 'geographic' && !geographic) {
      setMode('default');
    }
  }, [geographic, mode]);

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
    const degreeByNode = new Map<string, number>();
    const routesByNode = new Map<string, Set<string>>();
    for (const l of payload.links) {
      degreeByNode.set(l.source, (degreeByNode.get(l.source) ?? 0) + 1);
      degreeByNode.set(l.target, (degreeByNode.get(l.target) ?? 0) + 1);
      for (const rid of l.routeIds) {
        for (const endpoint of [l.source, l.target]) {
          if (!routesByNode.has(endpoint)) routesByNode.set(endpoint, new Set());
          routesByNode.get(endpoint)!.add(rid);
        }
      }
    }
    const nodes: FGNode[] = payload.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      lat: n.lat,
      lon: n.lon,
      degree: degreeByNode.get(n.id) ?? 0,
      routeIds: Array.from(routesByNode.get(n.id) ?? []),
    }));
    const links: FGLink[] = payload.links.map((l) => ({
      source: l.source,
      target: l.target,
      color: l.color ?? '#64748b',
      width: Math.max(1, Math.min(6, 1 + Math.log2(l.trips.length + 1))),
      tripCount: l.trips.length,
    }));
    return { nodes, links };
  }, [payload]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || data.nodes.length === 0) return;

    // Release any pinned positions from a previous mode.
    for (const n of data.nodes) {
      delete n.fx;
      delete n.fy;
    }

    const setCharge = (strength: number, distanceMax?: number) => {
      const f = forceManyBody<FGNode>().strength(strength);
      if (distanceMax != null) f.distanceMax(distanceMax);
      fg.d3Force('charge', f);
    };
    const setLinkDistance = (distance: number) => {
      const existing = fg.d3Force('link') as
        | ReturnType<typeof forceLink<FGNode, FGLink>>
        | undefined;
      if (existing) existing.distance(distance);
      else fg.d3Force('link', forceLink<FGNode, FGLink>().id((n) => n.id).distance(distance));
    };

    // Reset named forces each mode switch so they don't leak between modes.
    fg.d3Force('radial', null);
    fg.d3Force('x', null);
    fg.d3Force('y', null);
    fg.d3Force('collide', null);

    switch (mode) {
      case 'default':
        setCharge(-30);
        setLinkDistance(30);
        break;
      case 'spread':
        setCharge(-400);
        setLinkDistance(120);
        fg.d3Force('collide', forceCollide<FGNode>(8));
        break;
      case 'compact':
        setCharge(-40, 150);
        setLinkDistance(20);
        fg.d3Force('collide', forceCollide<FGNode>(3));
        break;
      case 'radial-degree': {
        setCharge(-60);
        setLinkDistance(30);
        const maxDeg = Math.max(1, ...data.nodes.map((n) => n.degree));
        // Highest-degree nodes end up near the center.
        fg.d3Force(
          'radial',
          forceRadial<FGNode>(
            (n) => (1 - n.degree / maxDeg) * 260 + 20,
            0,
            0,
          ).strength(0.8),
        );
        fg.d3Force('collide', forceCollide<FGNode>(5));
        break;
      }
      case 'geographic': {
        const SCALE = 20000;
        for (const n of data.nodes) {
          if (n.lat != null && n.lon != null) {
            n.fx = n.lon * SCALE;
            n.fy = -n.lat * SCALE;
          }
        }
        setCharge(0);
        setLinkDistance(30);
        break;
      }
      case 'clustered-route': {
        setCharge(-60);
        setLinkDistance(25);
        // Compute one target (x, y) per route on a circle; pull each node toward its routes' average target.
        const routeIds = Array.from(
          new Set(data.nodes.flatMap((n) => n.routeIds)),
        );
        const centers = new Map<string, { x: number; y: number }>();
        const radius = 250;
        routeIds.forEach((rid, i) => {
          const angle = (i / Math.max(1, routeIds.length)) * Math.PI * 2;
          centers.set(rid, {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
          });
        });
        const targetFor = (n: FGNode) => {
          if (n.routeIds.length === 0) return { x: 0, y: 0 };
          let x = 0;
          let y = 0;
          for (const r of n.routeIds) {
            const c = centers.get(r) ?? { x: 0, y: 0 };
            x += c.x;
            y += c.y;
          }
          return { x: x / n.routeIds.length, y: y / n.routeIds.length };
        };
        fg.d3Force('x', forceX<FGNode>((n) => targetFor(n).x).strength(0.2));
        fg.d3Force('y', forceY<FGNode>((n) => targetFor(n).y).strength(0.2));
        fg.d3Force('collide', forceCollide<FGNode>(5));
        break;
      }
    }

    fg.d3ReheatSimulation();
  }, [mode, data]);

  const options: ForceMode[] = [
    'default',
    'spread',
    'compact',
    'radial-degree',
    ...(geographic ? (['geographic'] as ForceMode[]) : []),
    'clustered-route',
  ];

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
    >
      <div className="absolute left-3 top-3 z-10 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-zinc-300">
        react-force-graph-2d
      </div>
      <div className="absolute right-3 top-3 z-10">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as ForceMode)}
          className="rounded-md border border-zinc-700 bg-black/70 px-2 py-1 text-xs font-medium text-zinc-200 outline-none backdrop-blur hover:border-zinc-500 focus:border-emerald-500"
        >
          {options.map((k) => (
            <option key={k} value={k}>
              {MODE_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      {size.width > 0 && size.height > 0 ? (
        <ForceGraph2D<FGNode, FGLink>
          ref={fgRef}
          width={size.width}
          height={size.height}
          graphData={data}
          backgroundColor="#0b0d12"
          nodeRelSize={3}
          nodeLabel={(n) => n.label}
          nodeColor={() => '#e2e8f0'}
          linkColor={(l) => l.color}
          linkWidth={(l) => l.width}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={(l) => l.color}
          cooldownTicks={100}
        />
      ) : null}
    </div>
  );
}
