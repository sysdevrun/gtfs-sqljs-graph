import {
  GtfsSelector,
  fileTab,
  urlTab,
  transportDataGouvFr,
  mobilityDataCsv,
  type GtfsSelectionResult,
} from 'react-gtfs-selector';

interface Props {
  onSelect: (result: GtfsSelectionResult) => void;
}

const tabs = [fileTab, urlTab, transportDataGouvFr, mobilityDataCsv];

export function SourcePicker({ onSelect }: Props) {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          GTFS Graph Visualizer
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Load a GTFS feed, pick trips, and compare two stop-to-stop graph layouts.
        </p>
      </header>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
        <GtfsSelector onSelect={onSelect} tabs={tabs} />
      </div>
    </div>
  );
}
