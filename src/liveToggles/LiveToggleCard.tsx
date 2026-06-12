import { Check, Pencil, Plus, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { findLiveToggles } from "./liveToggleSource";
import {
  createLiveToggleView,
  readLiveToggleViews,
  renameLiveToggleView,
  setLiveToggleValueForActiveView,
  switchLiveToggleView,
} from "./liveToggleViews";

interface LiveToggleCardProps {
  source: string;
  onChange: (source: string) => void;
}

export function LiveToggleCard({ source, onChange }: LiveToggleCardProps) {
  const [viewFormMode, setViewFormMode] = useState<"create" | "rename" | null>(
    null,
  );
  const [viewName, setViewName] = useState("");
  const toggles = findLiveToggles(source);
  if (toggles.length === 0) return null;
  const viewState = readLiveToggleViews(source);
  const normalizedName = viewName.trim();
  const duplicateName = viewState.views.some((view) => {
    if (
      viewFormMode === "rename" &&
      view.name === viewState.activeView
    ) {
      return false;
    }
    return (
      view.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
    );
  });

  const saveViewName = () => {
    if (!normalizedName || duplicateName) return;
    onChange(
      viewFormMode === "rename"
        ? renameLiveToggleView(source, viewState.activeView, normalizedName)
        : createLiveToggleView(source, normalizedName),
    );
    setViewName("");
    setViewFormMode(null);
  };

  return (
    <section className="live-toggle-card" aria-labelledby="live-toggle-title">
      <div className="live-toggle-toolbar">
        <div className="live-toggle-heading">
          <SlidersHorizontal size={13} />
          <span id="live-toggle-title">Live toggles</span>
        </div>
        <div className="view-controls">
          <label className="view-select-label">
            <span>View</span>
            <select
              aria-label="Active view"
              value={viewState.activeView}
              onChange={(event) =>
                onChange(switchLiveToggleView(source, event.target.value))
              }
            >
              {viewState.views.map((view) => (
                <option key={view.name} value={view.name}>
                  {view.name}
                </option>
              ))}
            </select>
          </label>
          {viewFormMode === null ? (
            <>
              <button
                className="view-icon-button"
                type="button"
                aria-label="Rename view"
                title="Rename view"
                onClick={() => {
                  setViewName(viewState.activeView);
                  setViewFormMode("rename");
                }}
              >
                <Pencil size={12} />
              </button>
              <button
                className="view-icon-button"
                type="button"
                aria-label="Create view"
                title="Create view"
                onClick={() => setViewFormMode("create")}
              >
                <Plus size={13} />
              </button>
            </>
          ) : (
            <form
              className="view-create-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveViewName();
              }}
            >
              <input
                autoFocus
                aria-label={
                  viewFormMode === "rename"
                    ? "Rename view"
                    : "New view name"
                }
                value={viewName}
                maxLength={80}
                placeholder="View name"
                onChange={(event) => setViewName(event.target.value)}
              />
              <button
                className="view-icon-button"
                type="submit"
                aria-label={
                  viewFormMode === "rename"
                    ? "Save renamed view"
                    : "Save view"
                }
                title={duplicateName ? "View name already exists" : "Save view"}
                disabled={!normalizedName || duplicateName}
              >
                <Check size={13} />
              </button>
              <button
                className="view-icon-button"
                type="button"
                aria-label="Cancel editing view name"
                title="Cancel"
                onClick={() => {
                  setViewName("");
                  setViewFormMode(null);
                }}
              >
                <X size={13} />
              </button>
            </form>
          )}
        </div>
      </div>
      <div className="live-toggle-list">
        {toggles.map((toggle) => (
          <label className="live-toggle-control" key={toggle.name}>
            <input
              type="checkbox"
              checked={toggle.value}
              onChange={(event) =>
                onChange(
                  setLiveToggleValueForActiveView(
                    source,
                    toggle.name,
                    event.target.checked,
                  ),
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
