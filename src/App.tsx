import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GtfsSelectionResult } from 'react-gtfs-selector';
import { SourcePicker } from './components/SourcePicker';
import { RouteList } from './components/RouteList';
import { SelectionBar } from './components/SelectionBar';
import { GraphPanel } from './components/GraphPanel';
import { getGtfsWorker } from './worker/workerClient';
import type { GraphPayload, RouteSummary, TripSummary } from './types';

type Phase = 'select' | 'loading' | 'browse' | 'error';

const AUTO_BUILD_DELAY_MS = 100;

export function App() {
  const [phase, setPhase] = useState<Phase>('select');
  const [error, setError] = useState<string | null>(null);
  const [feedLabel, setFeedLabel] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  const tripCache = useRef<
    Map<string, { direction0: TripSummary[]; direction1: TripSummary[] }>
  >(new Map());
  const buildGeneration = useRef(0);

  const worker = useMemo(() => getGtfsWorker(), []);

  const handleSelect = useCallback(
    async (result: GtfsSelectionResult) => {
      setPhase('loading');
      setError(null);
      setFeedLabel(
        result.type === 'file' ? result.fileName : (result.title ?? result.url),
      );
      tripCache.current = new Map();
      buildGeneration.current += 1;
      setSelected(new Set());
      setGraph(null);
      setIsBuilding(false);
      setRoutes([]);
      try {
        if (result.type === 'file') {
          await worker.loadFromBlob(result.blob);
        } else {
          await worker.loadFromUrl(result.url);
        }
        const r = await worker.getRoutes();
        setRoutes(r);
        setPhase('browse');
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
      }
    },
    [worker],
  );

  const loadTrips = useCallback(
    async (routeId: string) => {
      const cached = tripCache.current.get(routeId);
      if (cached) return cached;
      const result = await worker.getTripsByRoute(routeId);
      tripCache.current.set(routeId, result);
      return result;
    },
    [worker],
  );

  const toggleTrip = useCallback((tripId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
  }, []);

  const setMany = useCallback((tripIds: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) tripIds.forEach((id) => next.add(id));
      else tripIds.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const selectAllTrips = useCallback(async () => {
    const ids = await worker.getAllTripIds();
    setSelected(new Set(ids));
  }, [worker]);

  useEffect(() => {
    if (phase !== 'browse') return;

    if (selected.size === 0) {
      buildGeneration.current += 1;
      setGraph(null);
      setIsBuilding(false);
      return;
    }

    const tripIds = Array.from(selected);
    const timer = window.setTimeout(() => {
      const gen = ++buildGeneration.current;
      setIsBuilding(true);
      worker
        .buildGraph(tripIds)
        .then((result) => {
          if (gen !== buildGeneration.current) return;
          setGraph(result);
          setIsBuilding(false);
        })
        .catch((err) => {
          if (gen !== buildGeneration.current) return;
          console.error(err);
          setError(err instanceof Error ? err.message : String(err));
          setPhase('error');
          setIsBuilding(false);
        });
    }, AUTO_BUILD_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [selected, phase, worker]);

  const resetFeed = useCallback(async () => {
    buildGeneration.current += 1;
    await worker.close().catch(() => {});
    tripCache.current = new Map();
    setSelected(new Set());
    setGraph(null);
    setIsBuilding(false);
    setRoutes([]);
    setFeedLabel(null);
    setError(null);
    setPhase('select');
  }, [worker]);

  useEffect(() => {
    return () => {
      worker.close().catch(() => {});
    };
  }, [worker]);

  if (phase === 'select') {
    return (
      <main className="flex min-h-full items-center justify-center p-8">
        <SourcePicker onSelect={handleSelect} />
      </main>
    );
  }

  if (phase === 'loading') {
    return (
      <main className="flex min-h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
          <p className="mt-4 text-sm text-zinc-300">
            Loading {feedLabel ?? 'GTFS feed'}…
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Parsing ZIP and building SQLite in a web worker.
          </p>
        </div>
      </main>
    );
  }

  if (phase === 'error') {
    return (
      <main className="flex min-h-full items-center justify-center p-8">
        <div className="max-w-lg rounded-xl border border-red-900/60 bg-red-950/40 p-6">
          <h2 className="text-lg font-semibold text-red-300">Something went wrong</h2>
          <p className="mt-2 break-words text-sm text-red-200/80">
            {error ?? 'Unknown error'}
          </p>
          <button
            onClick={resetFeed}
            className="mt-4 rounded-md bg-red-500/20 px-3 py-1.5 text-sm text-red-100 hover:bg-red-500/30"
          >
            Try another feed
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-full">
      <aside className="flex w-96 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
        <header className="border-b border-zinc-800 px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Feed</div>
          <div className="mt-0.5 truncate text-sm font-medium text-zinc-100">
            {feedLabel ?? '—'}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">{routes.length} routes</span>
            <button
              onClick={selectAllTrips}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
            >
              Select all trips
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <RouteList
            routes={routes}
            selected={selected}
            onToggleTrip={toggleTrip}
            onSetMany={setMany}
            loadTrips={loadTrips}
          />
        </div>
        <SelectionBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onReset={resetFeed}
          building={isBuilding}
        />
      </aside>
      <section className="min-w-0 flex-1 p-4">
        <GraphPanel
          payload={graph ?? { nodes: [], links: [], routeColors: {} }}
        />
      </section>
    </main>
  );
}
