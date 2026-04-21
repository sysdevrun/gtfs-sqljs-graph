import type { GraphPayload } from '../types';
import { CytoscapeView } from './CytoscapeView';
import { ForceGraphView } from './ForceGraphView';

interface Props {
  payload: GraphPayload;
}

export function GraphPanel({ payload }: Props) {
  const hasGraph = payload.nodes.length > 0;
  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex items-center gap-4 text-sm text-zinc-400">
        <span>
          <span className="font-semibold text-zinc-100">{payload.nodes.length}</span>{' '}
          stops
        </span>
        <span>
          <span className="font-semibold text-zinc-100">{payload.links.length}</span>{' '}
          edges
        </span>
        <span>
          <span className="font-semibold text-zinc-100">
            {Object.keys(payload.routeColors).length}
          </span>{' '}
          routes
        </span>
      </div>
      {hasGraph ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
          <CytoscapeView payload={payload} />
          <ForceGraphView payload={payload} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-500">
          No graph yet — pick trips on the left and click “Build graph”.
        </div>
      )}
    </div>
  );
}
