export interface LegendItem {
  readonly keys: string;
  readonly label: string;
}

export function KeyLegend(props: { readonly items: readonly LegendItem[] }) {
  return (
    <footer className="flex flex-wrap items-center gap-x-10 gap-y-2 text-[1.5rem] text-faint" data-testid="key-legend">
      {props.items.map((item) => (
        <span key={item.keys + item.label} className="flex items-center gap-3">
          <kbd className="rounded-md border-2 border-line px-3 py-0.5 font-display text-[1.5rem] font-semibold text-dim">{item.keys}</kbd>
          {item.label}
        </span>
      ))}
    </footer>
  );
}
