import { SlidersHorizontal } from "lucide-react";
import { findLiveToggles, setLiveToggleValue } from "./liveToggleSource";

interface LiveToggleCardProps {
  source: string;
  onChange: (source: string) => void;
}

export function LiveToggleCard({ source, onChange }: LiveToggleCardProps) {
  const toggles = findLiveToggles(source);
  if (toggles.length === 0) return null;

  return (
    <section className="live-toggle-card" aria-labelledby="live-toggle-title">
      <div className="live-toggle-heading">
        <SlidersHorizontal size={13} />
        <span id="live-toggle-title">Live toggles</span>
      </div>
      <div className="live-toggle-list">
        {toggles.map((toggle) => (
          <label className="live-toggle-control" key={toggle.name}>
            <input
              type="checkbox"
              checked={toggle.value}
              onChange={(event) =>
                onChange(
                  setLiveToggleValue(source, toggle.name, event.target.checked),
                )
              }
            />
            <span>{toggle.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
