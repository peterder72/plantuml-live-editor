import {
  Check,
  Pencil,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";
import { addLiveToggle, findLiveToggles } from "./liveToggleSource";
import {
  type SourceSelection,
  type WrappedLiveToggleSelection,
  wrapSelectionWithLiveToggle,
} from "./liveToggleWrap";
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
  selection?: SourceSelection;
  onWrap?: (wrapped: WrappedLiveToggleSelection) => void;
}

export function LiveToggleCard({
  source,
  onChange,
  selection = { from: 0, to: 0 },
  onWrap,
}: LiveToggleCardProps) {
  const [viewFormMode, setViewFormMode] = useState<"create" | "rename" | null>(
    null,
  );
  const [viewName, setViewName] = useState("");
  const [isAddingFlag, setIsAddingFlag] = useState(false);
  const [flagName, setFlagName] = useState("");
  const toggles = findLiveToggles(source);
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
  const normalizedFlagName = flagName.trim();
  const invalidFlagName =
    !/^[A-Za-z0-9_]+$/.test(normalizedFlagName) ||
    toggles.some((toggle) => toggle.label === normalizedFlagName);
  const canWrap = selection.from !== selection.to && toggles.length > 0;
  const wrapUnavailableReason =
    toggles.length === 0
      ? "Add a live toggle first."
      : "Select one or more lines to wrap.";

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

  const saveFlag = () => {
    if (invalidFlagName) return;
    onChange(addLiveToggle(source, normalizedFlagName));
    setFlagName("");
    setIsAddingFlag(false);
  };

  const wrapWithToggle = (toggleName: string) => {
    const wrapped = wrapSelectionWithLiveToggle(source, selection, toggleName);
    if (wrapped) onWrap?.(wrapped);
  };

  return (
    <section className="live-toggle-card" aria-labelledby="live-toggle-title">
      <div className="live-toggle-toolbar">
        <div className="live-toggle-heading">
          <SlidersHorizontal size={13} />
          <span id="live-toggle-title">Live toggles</span>
          {!isAddingFlag ? (
            <button
              className="view-icon-button"
              type="button"
              aria-label="Add flag"
              title="Add flag"
              onClick={() => setIsAddingFlag(true)}
            >
              <Plus size={13} />
            </button>
          ) : (
            <InlineNameForm
              value={flagName}
              inputLabel="New flag name"
              placeholder="Flag name"
              saveLabel="Save flag"
              cancelLabel="Cancel adding flag"
              disabled={invalidFlagName}
              disabledTitle="Use a unique name containing only letters, numbers, or underscores"
              onChange={setFlagName}
              onSubmit={saveFlag}
              onCancel={() => {
                setFlagName("");
                setIsAddingFlag(false);
              }}
            />
          )}
        </div>
        <div className="view-controls">
          <select
            className="wrap-action-select"
            aria-label="Wrap selection"
            value=""
            disabled={!canWrap}
            title={
              canWrap ? "Wrap selection with a live flag" : wrapUnavailableReason
            }
            onChange={(event) => wrapWithToggle(event.target.value)}
          >
            <option value="" disabled>
              Wrap selection
            </option>
            {toggles.map((toggle) => (
              <option key={toggle.name} value={toggle.name}>
                {toggle.label} — {toggle.value ? "On" : "Off"}
              </option>
            ))}
          </select>
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
            <InlineNameForm
              value={viewName}
              inputLabel={
                viewFormMode === "rename" ? "Rename view" : "New view name"
              }
              placeholder="View name"
              saveLabel={
                viewFormMode === "rename" ? "Save renamed view" : "Save view"
              }
              cancelLabel="Cancel editing view name"
              disabled={!normalizedName || duplicateName}
              disabledTitle={
                duplicateName ? "View name already exists" : "Enter a view name"
              }
              onChange={setViewName}
              onSubmit={saveViewName}
              onCancel={() => {
                setViewName("");
                setViewFormMode(null);
              }}
            />
          )}
        </div>
      </div>
      {toggles.length > 0 && (
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
      )}
    </section>
  );
}

interface InlineNameFormProps {
  value: string;
  inputLabel: string;
  placeholder: string;
  saveLabel: string;
  cancelLabel: string;
  disabled: boolean;
  disabledTitle: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function InlineNameForm({
  value,
  inputLabel,
  placeholder,
  saveLabel,
  cancelLabel,
  disabled,
  disabledTitle,
  onChange,
  onSubmit,
  onCancel,
}: InlineNameFormProps) {
  return (
    <form
      className="view-create-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input
        autoFocus
        aria-label={inputLabel}
        value={value}
        maxLength={80}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        className="view-icon-button"
        type="submit"
        aria-label={saveLabel}
        title={disabled ? disabledTitle : saveLabel}
        disabled={disabled}
      >
        <Check size={13} />
      </button>
      <button
        className="view-icon-button"
        type="button"
        aria-label={cancelLabel}
        title="Cancel"
        onClick={onCancel}
      >
        <X size={13} />
      </button>
    </form>
  );
}
