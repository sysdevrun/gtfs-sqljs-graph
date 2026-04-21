import { useCallback, useEffect, useState } from 'react';
import type { RouteSummary, TripSummary } from '../types';
import { routeBg, routeFg } from '../lib/colors';
import { TripRow } from './TripRow';

interface Props {
  routes: RouteSummary[];
  selected: Set<string>;
  onToggleTrip: (tripId: string) => void;
  onSetMany: (tripIds: string[], checked: boolean) => void;
  loadTrips: (routeId: string) => Promise<{
    direction0: TripSummary[];
    direction1: TripSummary[];
  }>;
}

interface RouteBucket {
  direction0: TripSummary[];
  direction1: TripSummary[];
  loading: boolean;
}

export function RouteList({
  routes,
  selected,
  onToggleTrip,
  onSetMany,
  loadTrips,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [buckets, setBuckets] = useState<Record<string, RouteBucket | undefined>>({});

  const toggleExpand = useCallback(
    (routeId: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(routeId)) next.delete(routeId);
        else next.add(routeId);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    for (const routeId of expanded) {
      if (buckets[routeId]) continue;
      setBuckets((prev) => ({
        ...prev,
        [routeId]: { direction0: [], direction1: [], loading: true },
      }));
      loadTrips(routeId).then((result) => {
        setBuckets((prev) => ({
          ...prev,
          [routeId]: { ...result, loading: false },
        }));
      });
    }
  }, [expanded, buckets, loadTrips]);

  return (
    <ul className="flex flex-col gap-1.5">
      {routes.map((route) => {
        const bucket = buckets[route.routeId];
        const isOpen = expanded.has(route.routeId);
        const allTripsHere = bucket
          ? [...bucket.direction0, ...bucket.direction1]
          : [];
        const routeSelectedCount = allTripsHere.filter((t) =>
          selected.has(t.tripId),
        ).length;
        return (
          <li
            key={route.routeId}
            className="overflow-hidden rounded-lg border border-zinc-800"
          >
            <button
              onClick={() => toggleExpand(route.routeId)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-opacity hover:opacity-90"
              style={{
                background: routeBg(route.color),
                color: routeFg(route.textColor),
              }}
            >
              <span
                className={`text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}
                aria-hidden
              >
                ▶
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {route.shortName || route.routeId}
                </span>
                {route.longName ? (
                  <span className="block truncate text-xs opacity-90">
                    {route.longName}
                  </span>
                ) : null}
              </span>
              {routeSelectedCount > 0 ? (
                <span className="shrink-0 rounded-full bg-black/30 px-2 py-0.5 text-xs font-medium">
                  {routeSelectedCount}
                </span>
              ) : null}
            </button>
            {isOpen ? (
              <div className="bg-zinc-950/60 px-2 py-2">
                {bucket?.loading ? (
                  <div className="px-2 py-4 text-xs text-zinc-500">Loading trips…</div>
                ) : bucket && allTripsHere.length === 0 ? (
                  <div className="px-2 py-4 text-xs text-zinc-500">
                    No trips for this route.
                  </div>
                ) : bucket ? (
                  <>
                    <div className="mb-2 flex items-center justify-between px-2">
                      <span className="text-xs uppercase tracking-wider text-zinc-500">
                        All directions
                      </span>
                      <RouteWideToggle
                        trips={allTripsHere}
                        selected={selected}
                        onSetMany={onSetMany}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <DirectionColumn
                        label="Direction 0"
                        trips={bucket.direction0}
                        selected={selected}
                        onToggleTrip={onToggleTrip}
                        onSetMany={onSetMany}
                      />
                      <DirectionColumn
                        label="Direction 1"
                        trips={bucket.direction1}
                        selected={selected}
                        onToggleTrip={onToggleTrip}
                        onSetMany={onSetMany}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function DirectionColumn({
  label,
  trips,
  selected,
  onToggleTrip,
  onSetMany,
}: {
  label: string;
  trips: TripSummary[];
  selected: Set<string>;
  onToggleTrip: (tripId: string) => void;
  onSetMany: (tripIds: string[], checked: boolean) => void;
}) {
  if (trips.length === 0) {
    return (
      <div className="rounded border border-dashed border-zinc-800 px-2 py-2 text-xs text-zinc-600">
        {label} — no trips
      </div>
    );
  }
  const allSelected = trips.every((t) => selected.has(t.tripId));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {label}
          <span className="ml-2 font-normal text-zinc-600">({trips.length})</span>
        </span>
        <button
          onClick={() => onSetMany(trips.map((t) => t.tripId), !allSelected)}
          className="text-xs text-emerald-400 hover:text-emerald-300"
        >
          {allSelected ? 'Clear' : 'All'}
        </button>
      </div>
      <div className="flex flex-col">
        {trips.map((trip) => (
          <TripRow
            key={trip.tripId}
            trip={trip}
            checked={selected.has(trip.tripId)}
            onToggle={onToggleTrip}
          />
        ))}
      </div>
    </div>
  );
}

function RouteWideToggle({
  trips,
  selected,
  onSetMany,
}: {
  trips: TripSummary[];
  selected: Set<string>;
  onSetMany: (tripIds: string[], checked: boolean) => void;
}) {
  const allSelected = trips.length > 0 && trips.every((t) => selected.has(t.tripId));
  return (
    <button
      onClick={() => onSetMany(trips.map((t) => t.tripId), !allSelected)}
      className="text-xs text-emerald-400 hover:text-emerald-300"
    >
      {allSelected ? 'Clear route' : 'Select route'}
    </button>
  );
}
