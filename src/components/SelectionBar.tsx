interface Props {
  count: number;
  onClear: () => void;
  onReset: () => void;
  building: boolean;
}

export function SelectionBar({ count, onClear, onReset, building }: Props) {
  return (
    <div className="sticky bottom-0 flex items-center gap-2 border-t border-zinc-800 bg-zinc-950/95 px-3 py-3 backdrop-blur">
      <span className="flex-1 text-sm text-zinc-300">
        <span className="font-semibold text-white">{count}</span> trip
        {count === 1 ? '' : 's'} selected
        {building ? (
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            rebuilding…
          </span>
        ) : null}
      </span>
      {count > 0 ? (
        <button
          onClick={onClear}
          className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          Clear
        </button>
      ) : null}
      <button
        onClick={onReset}
        className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      >
        New feed
      </button>
    </div>
  );
}
