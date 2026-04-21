import * as Comlink from 'comlink';
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type {
  RouteSummary,
  TripSummary,
  StopInfo,
  GraphPayload,
  GraphLink,
  GraphNode,
  EdgeTripInfo,
} from '../types';
import { normalizeHex } from '../lib/colors';

let gtfs: GtfsSqlJs | null = null;
let routeColorCache: Map<string, string | null> = new Map();

async function ensureAdapter() {
  return createSqlJsAdapter({ locateFile: () => sqlWasmUrl });
}

function proxify(url: string): string {
  if (!url.startsWith('https://')) return url;
  return `https://gtfs-proxy.sys-dev-run.re/proxy/${url.substring(8)}`;
}

async function closeExisting() {
  if (gtfs) {
    try {
      await gtfs.close();
    } catch {
      // ignore
    }
    gtfs = null;
    routeColorCache = new Map();
  }
}

const api = {
  async loadFromBlob(blob: Blob): Promise<void> {
    await closeExisting();
    const buf = await blob.arrayBuffer();
    gtfs = await GtfsSqlJs.fromZipData(new Uint8Array(buf), {
      adapter: await ensureAdapter(),
    });
  },

  async loadFromUrl(url: string): Promise<void> {
    await closeExisting();
    gtfs = await GtfsSqlJs.fromZip(proxify(url), {
      adapter: await ensureAdapter(),
    });
  },

  async getRoutes(): Promise<RouteSummary[]> {
    if (!gtfs) throw new Error('GTFS not loaded');
    const rows = await gtfs.getRoutes();
    routeColorCache = new Map();
    const summaries: RouteSummary[] = rows.map((r) => {
      const color = normalizeHex(r.route_color ?? null);
      routeColorCache.set(r.route_id, color);
      return {
        routeId: r.route_id,
        shortName: r.route_short_name ?? null,
        longName: r.route_long_name ?? null,
        color,
        textColor: normalizeHex(r.route_text_color ?? null),
        type: r.route_type ?? null,
      };
    });
    return summaries;
  },

  async getTripsByRoute(
    routeId: string,
  ): Promise<{ direction0: TripSummary[]; direction1: TripSummary[] }> {
    if (!gtfs) throw new Error('GTFS not loaded');
    const all = await gtfs.getTrips({ routeId });
    const direction0: TripSummary[] = [];
    const direction1: TripSummary[] = [];
    for (const t of all) {
      const summary: TripSummary = {
        tripId: t.trip_id,
        routeId: t.route_id,
        directionId: t.direction_id ?? null,
        shortName: t.trip_short_name ?? null,
        headsign: t.trip_headsign ?? null,
      };
      if (t.direction_id === 1) direction1.push(summary);
      else direction0.push(summary);
    }
    return { direction0, direction1 };
  },

  async buildGraph(tripIds: string[]): Promise<GraphPayload> {
    if (!gtfs) throw new Error('GTFS not loaded');
    if (tripIds.length === 0) {
      return { nodes: [], links: [], routeColors: {} };
    }

    const graph = await gtfs.buildGraph(tripIds);

    const stopIdSet = new Set<string>();
    const links: GraphLink[] = [];
    const routeIdSet = new Set<string>();

    for (const [fromId, inner] of graph.entries()) {
      stopIdSet.add(fromId);
      for (const [toId, edge] of inner.entries()) {
        stopIdSet.add(toId);
        const trips: EdgeTripInfo[] = edge.trips.map((t) => ({
          tripId: t.tripId,
          routeId: t.routeId,
          directionId: t.directionId,
        }));
        const routeIds = Array.from(new Set(trips.map((t) => t.routeId)));
        routeIds.forEach((r) => routeIdSet.add(r));
        const firstColor = routeColorCache.get(routeIds[0]) ?? null;
        links.push({
          source: fromId,
          target: toId,
          trips,
          routeIds,
          color: firstColor,
        });
      }
    }

    const stopIds = Array.from(stopIdSet);
    const stopRows = stopIds.length
      ? await gtfs.getStops({ stopId: stopIds })
      : [];
    const stopLookup = new Map<string, StopInfo>();
    for (const s of stopRows) {
      stopLookup.set(s.stop_id, {
        id: s.stop_id,
        name: s.stop_name ?? s.stop_id,
        lat: s.stop_lat ?? null,
        lon: s.stop_lon ?? null,
      });
    }

    const nodes: GraphNode[] = stopIds.map((id) => {
      const info = stopLookup.get(id);
      return {
        id,
        label: info?.name ?? id,
        lat: info?.lat ?? null,
        lon: info?.lon ?? null,
      };
    });

    const routeColors: Record<string, string | null> = {};
    for (const routeId of routeIdSet) {
      routeColors[routeId] = routeColorCache.get(routeId) ?? null;
    }

    return { nodes, links, routeColors };
  },

  async close(): Promise<void> {
    await closeExisting();
  },
};

export type GtfsWorkerApi = typeof api;

Comlink.expose(api);
