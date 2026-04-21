import * as Comlink from 'comlink';
import type { GtfsWorkerApi } from './gtfs-worker';

let singleton: Comlink.Remote<GtfsWorkerApi> | null = null;

export function getGtfsWorker(): Comlink.Remote<GtfsWorkerApi> {
  if (!singleton) {
    const worker = new Worker(new URL('./gtfs-worker.ts', import.meta.url), {
      type: 'module',
    });
    singleton = Comlink.wrap<GtfsWorkerApi>(worker);
  }
  return singleton;
}
