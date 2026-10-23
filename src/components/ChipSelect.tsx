"use client";

export interface ChipOption {
  value: string;
  label: string;
}

export function ChipSelect({
  options,
  selected,
  onChange,
  multiple = true,
  name,
}: {
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  name?: string;
}) {
  const toggle = (value: string) => {
    if (!multiple) return onChange(selected.includes(value) ? [] : [value]);
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={name}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            type="button"
            key={o.value}
            aria-pressed={on}
            data-chip={`${name ?? "chip"}:${o.value}`}
            className={`chip ${on ? "chip-on" : "chip-off"}`}
            onClick={() => toggle(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
