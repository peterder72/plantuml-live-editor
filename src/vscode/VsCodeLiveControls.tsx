import { Check, Pencil, Plus, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  addLiveToggle,
  findLiveToggles,
} from "../liveToggles/liveToggleSource";
import {
  type SourceSelection,
  type WrappedLiveToggleSelection,
  wrapSelectionWithLiveToggle,
} from "../liveToggles/liveToggleWrap";
import {
  createLiveToggleView,
  readLiveToggleViews,
  renameLiveToggleView,
  setLiveToggleValueForActiveView,
  switchLiveToggleView,
} from "../liveToggles/liveToggleViews";

interface VsCodeLiveControlsProps {
  source: string;
  selection: SourceSelection;
  onChange: (source: string) => void;
  onWrap: (wrapped: WrappedLiveToggleSelection) => void;
}

export function VsCodeLiveControls({
  source,
  selection,
  onChange,
  onWrap,
}: VsCodeLiveControlsProps) {
  const [viewFormMode, setViewFormMode] = useState<"create" | "rename" | null>(
    null,
  );
  const [viewName, setViewName] = useState("");
  const [isAddingFlag, setIsAddingFlag] = useState(false);
  const [flagName, setFlagName] = useState("");
  const toggles = findLiveToggles(source);
  const viewState = readLiveToggleViews(source);
  const normalizedViewName = viewName.trim();
  const duplicateViewName = viewState.views.some((view) => {
    if (viewFormMode === "rename" && view.name === viewState.activeView) {
      return false;
    }
    return (
      view.name.toLocaleLowerCase() === normalizedViewName.toLocaleLowerCase()
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

  const saveView = () => {
    if (!normalizedViewName || duplicateViewName) return;
    onChange(
      viewFormMode === "rename"
        ? renameLiveToggleView(
            source,
            viewState.activeView,
            normalizedViewName,
          )
        : createLiveToggleView(source, normalizedViewName),
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

  const wrapSelection = (toggleName: string) => {
    const wrapped = wrapSelectionWithLiveToggle(source, selection, toggleName);
    if (wrapped) onWrap(wrapped);
  };

  return (
    <div className="native-controls-content">
      <section className="native-control-section" aria-labelledby="views-title">
        <div className="native-section-heading">
          <h2 id="views-title">Views</h2>
        </div>

        <div className="native-control-row native-view-row">
          <label className="native-field native-grow-field">
            <span>Active view</span>
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
          {viewFormMode === null && (
            <div className="native-row-actions" aria-label="View actions">
              <IconButton
                label="Rename view"
                onClick={() => {
                  setViewName(viewState.activeView);
                  setViewFormMode("rename");
                }}
              >
                <Pencil size={14} />
              </IconButton>
              <IconButton label="Create view" onClick={() => setViewFormMode("create")}>
                <Plus size={15} />
              </IconButton>
            </div>
          )}
        </div>

        {viewFormMode && (
          <InlineNameForm
            value={viewName}
            inputLabel={
              viewFormMode === "rename" ? "Rename view" : "New view name"
            }
            placeholder={viewFormMode === "rename" ? "View name" : "New view"}
            saveLabel={
              viewFormMode === "rename" ? "Save renamed view" : "Save view"
            }
            disabled={!normalizedViewName || duplicateViewName}
            disabledTitle={
              duplicateViewName ? "View name already exists" : "Enter a view name"
            }
            onChange={setViewName}
            onSubmit={saveView}
            onCancel={() => {
              setViewName("");
              setViewFormMode(null);
            }}
          />
        )}

        <label className="native-field">
          <span>Selected text</span>
          <select
            aria-label="Wrap selection"
            value=""
            disabled={!canWrap}
            title={canWrap ? "Wrap selection with a live flag" : wrapUnavailableReason}
            onChange={(event) => wrapSelection(event.target.value)}
          >
            <option value="" disabled>
              Wrap selection with…
            </option>
            {toggles.map((toggle) => (
              <option key={toggle.name} value={toggle.name}>
                {toggle.label} — {toggle.value ? "On" : "Off"}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section
        className="native-control-section"
        aria-labelledby="live-toggles-title"
      >
        <div className="native-section-heading">
          <h2 id="live-toggles-title">Live toggles</h2>
          {!isAddingFlag && (
            <IconButton label="Add flag" onClick={() => setIsAddingFlag(true)}>
              <Plus size={15} />
            </IconButton>
          )}
        </div>

        {isAddingFlag && (
          <InlineNameForm
            value={flagName}
            inputLabel="New flag name"
            placeholder="Flag name"
            saveLabel="Save flag"
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

        <div className="native-toggle-list">
          {toggles.length === 0 ? (
            <p className="native-empty-message">No live toggles in this diagram.</p>
          ) : (
            toggles.map((toggle) => (
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
            ))
          )}
        </div>
      </section>
    </div>
  );
}

interface InlineNameFormProps {
  value: string;
  inputLabel: string;
  placeholder: string;
  saveLabel: string;
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
  disabled,
  disabledTitle,
  onChange,
  onSubmit,
  onCancel,
}: InlineNameFormProps) {
  return (
    <form
      className="native-inline-form"
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
      <IconButton
        type="submit"
        label={saveLabel}
        title={disabled ? disabledTitle : saveLabel}
        disabled={disabled}
      >
        <Check size={14} />
      </IconButton>
      <IconButton label="Cancel editing" title="Cancel" onClick={onCancel}>
        <X size={14} />
      </IconButton>
    </form>
  );
}

interface IconButtonProps {
  children: ReactNode;
  label: string;
  title?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}

function IconButton({
  children,
  label,
  title = label,
  type = "button",
  disabled,
  onClick,
}: IconButtonProps) {
  return (
    <button
      className="native-icon-button"
      type={type}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
