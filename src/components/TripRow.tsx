import type { TripSummary } from '../types';

interface Props {
  trip: TripSummary;
  checked: boolean;
  onToggle: (tripId: string) => void;
}

export function TripRow({ trip, checked, onToggle }: Props) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-800/60">
      <input
        type="checkbox"
        className="mt-1 h-3.5 w-3.5 accent-emerald-500"
        checked={checked}
        onChange={() => onToggle(trip.tripId)}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-zinc-100">
          {trip.shortName || trip.tripId}
        </span>
        {trip.headsign ? (
          <span className="block truncate text-xs text-zinc-400">{trip.headsign}</span>
        ) : null}
      </span>
    </label>
  );
}
