import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import type { Core, ElementDefinition, LayoutOptions } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';
import type { GraphPayload } from '../types';

cytoscape.use(dagre);
cytoscape.use(fcose);

type LayoutKey =
  | 'geographic'
  | 'fcose'
  | 'cose'
  | 'dagre-lr'
  | 'dagre-tb'
  | 'breadthfirst'
  | 'concentric'
  | 'circle'
  | 'grid'
  | 'random'
  | 'preset';

const LAYOUT_LABELS: Record<LayoutKey, string> = {
  geographic: 'Geographic (lat/lon)',
  fcose: 'fCoSE (force-directed)',
  cose: 'CoSE (force-directed)',
  'dagre-lr': 'Dagre — left→right',
  'dagre-tb': 'Dagre — top→bottom',
  breadthfirst: 'Breadth-first',
  concentric: 'Concentric',
  circle: 'Circle',
  grid: 'Grid',
  random: 'Random',
  preset: 'Preset (no layout)',
};

function hasCoords(payload: GraphPayload): boolean {
  return (
    payload.nodes.length > 0 &&
    payload.nodes.every((n) => n.lat != null && n.lon != null)
  );
}

function buildLayoutOptions(key: LayoutKey): LayoutOptions {
  const common = { fit: true, padding: 30, animate: false as const };
  switch (key) {
    case 'geographic':
    case 'preset':
      return { name: 'preset', ...common };
    case 'fcose':
      return {
        name: 'fcose',
        quality: 'default',
        randomize: true,
        nodeSeparation: 120,
        idealEdgeLength: 80,
        ...common,
      } as LayoutOptions;
    case 'cose':
      return {
        name: 'cose',
        idealEdgeLength: () => 80,
        nodeOverlap: 20,
        randomize: true,
        componentSpacing: 100,
        ...common,
      } as LayoutOptions;
    case 'dagre-lr':
      return {
        name: 'dagre',
        // @ts-expect-error dagre-specific option
        rankDir: 'LR',
        nodeSep: 24,
        rankSep: 60,
        ...common,
      };
    case 'dagre-tb':
      return {
        name: 'dagre',
        // @ts-expect-error dagre-specific option
        rankDir: 'TB',
        nodeSep: 24,
        rankSep: 60,
        ...common,
      };
    case 'breadthfirst':
      return {
        name: 'breadthfirst',
        directed: true,
        spacingFactor: 1.2,
        ...common,
      };
    case 'concentric':
      return {
        name: 'concentric',
        concentric: (node) => node.degree(false),
        levelWidth: () => 2,
        minNodeSpacing: 30,
        ...common,
      };
    case 'circle':
      return { name: 'circle', ...common };
    case 'grid':
      return { name: 'grid', ...common };
    case 'random':
      return { name: 'random', ...common };
  }
}

interface Props {
  payload: GraphPayload;
}

export function CytoscapeView({ payload }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  const geographic = useMemo(() => hasCoords(payload), [payload]);
  const [layoutKey, setLayoutKey] = useState<LayoutKey>(
    geographic ? 'geographic' : 'fcose',
  );

  // When the payload changes and the previous choice was 'geographic' but new data lacks coords,
  // fall back to fcose automatically.
  useEffect(() => {
    if (layoutKey === 'geographic' && !geographic) {
      setLayoutKey('fcose');
    }
  }, [geographic, layoutKey]);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const SCALE = 10000;
    const usePreset = layoutKey === 'geographic' && geographic;
    const elements: ElementDefinition[] = [
      ...payload.nodes.map((n) => {
        const def: ElementDefinition = {
          data: { id: n.id, label: n.label },
        };
        if (usePreset && n.lat != null && n.lon != null) {
          def.position = { x: n.lon * SCALE, y: -n.lat * SCALE };
        }
        return def;
      }),
      ...payload.links.map((l, idx) => ({
        data: {
          id: `e${idx}`,
          source: l.source,
          target: l.target,
          weight: l.trips.length,
          color: l.color ?? '#64748b',
        },
      })),
    ];

    const cy = cytoscape({
      container: el,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#e2e8f0',
            color: '#e6e9ef',
            'font-size': 50,
            'text-valign': 'center',
            'text-halign': 'right',
            'text-margin-x': 12,
            'text-outline-color': '#0b0d12',
            'text-outline-width': 5,
            width: 25,
            height: 25,
            'border-width': 2,
            'border-color': '#0b0d12',
            'overlay-padding': 12,
          },
        },
        {
          selector: 'node.hovered',
          style: {
            label: 'data(label)',
            'background-color': '#34d399',
            'border-color': '#34d399',
            width: 34,
            height: 34,
            'z-index': 10,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 'mapData(weight, 1, 50, 2, 8)',
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1,
            opacity: 0.75,
          },
        },
      ],
      wheelSensitivity: 0.2,
      maxZoom: 3,
      minZoom: 0.1,
      layout: buildLayoutOptions(layoutKey),
    });

    cyRef.current = cy;

    cy.on('mouseover', 'node', (evt) => evt.target.addClass('hovered'));
    cy.on('mouseout', 'node', (evt) => evt.target.removeClass('hovered'));

    const refit = () => {
      cy.resize();
      cy.fit(undefined, 30);
    };
    refit();

    const ro = new ResizeObserver(refit);
    ro.observe(el);

    return () => {
      ro.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [payload, layoutKey, geographic]);

  const options: LayoutKey[] = [
    ...(geographic ? (['geographic'] as LayoutKey[]) : []),
    'fcose',
    'cose',
    'dagre-lr',
    'dagre-tb',
    'breadthfirst',
    'concentric',
    'circle',
    'grid',
    'random',
  ];

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="absolute left-3 top-3 z-10 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-zinc-300">
        Cytoscape
      </div>
      <div className="absolute right-3 top-3 z-10">
        <select
          value={layoutKey}
          onChange={(e) => setLayoutKey(e.target.value as LayoutKey)}
          className="rounded-md border border-zinc-700 bg-black/70 px-2 py-1 text-xs font-medium text-zinc-200 outline-none backdrop-blur hover:border-zinc-500 focus:border-emerald-500"
        >
          {options.map((k) => (
            <option key={k} value={k}>
              {LAYOUT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
