import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { Core, ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { GraphPayload } from '../types';

cytoscape.use(dagre);

interface Props {
  payload: GraphPayload;
}

function hasCoords(payload: GraphPayload): boolean {
  return payload.nodes.every((n) => n.lat != null && n.lon != null);
}

export function CytoscapeView({ payload }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const geographic = hasCoords(payload);
    const SCALE = 10000;
    const elements: ElementDefinition[] = [
      ...payload.nodes.map((n) => {
        const def: ElementDefinition = {
          data: { id: n.id, label: n.label },
        };
        if (geographic && n.lat != null && n.lon != null) {
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
            label: 'data(label)',
            color: '#e6e9ef',
            'font-size': 80,
            'text-valign': 'center',
            'text-halign': 'right',
            'text-margin-x': 30,
            'text-outline-color': '#0b0d12',
            'text-outline-width': 8,
            width: 60,
            height: 60,
            'border-width': 4,
            'border-color': '#0b0d12',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 'mapData(weight, 1, 50, 10, 40)',
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 2,
            opacity: 0.85,
          },
        },
      ],
      wheelSensitivity: 0.2,
      maxZoom: 3,
      minZoom: 0.1,
      layout: geographic
        ? { name: 'preset', fit: true, padding: 40 }
        : {
            name: 'dagre',
            // @ts-expect-error dagre layout options are not in base typings
            rankDir: 'LR',
            nodeSep: 24,
            rankSep: 60,
            fit: true,
            padding: 20,
          },
    });

    cyRef.current = cy;

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
  }, [payload]);

  const geographic = hasCoords(payload);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="absolute left-3 top-3 z-10 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-zinc-300">
        Cytoscape · {geographic ? 'geographic (lat/lon)' : 'dagre (hierarchical)'}
      </div>
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
