import {
  Check,
  ChevronDown,
  Pencil,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
  const [isWrapMenuOpen, setIsWrapMenuOpen] = useState(false);
  const wrapMenuId = useId();
  const wrapMenuRef = useRef<HTMLDivElement>(null);
  const wrapTriggerRef = useRef<HTMLButtonElement>(null);
  const wrapItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
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

  useEffect(() => {
    if (!canWrap) setIsWrapMenuOpen(false);
  }, [canWrap]);

  useEffect(() => {
    if (!isWrapMenuOpen) return;

    wrapItemRefs.current[0]?.focus();

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        !wrapMenuRef.current?.contains(target) &&
        !wrapTriggerRef.current?.contains(target)
      ) {
        setIsWrapMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isWrapMenuOpen]);

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
    setIsWrapMenuOpen(false);
    if (wrapped) onWrap?.(wrapped);
  };

  const handleWrapMenuKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    const currentIndex = wrapItemRefs.current.findIndex(
      (item) => item === document.activeElement,
    );
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % toggles.length;
        break;
      case "ArrowUp":
        nextIndex =
          (currentIndex - 1 + toggles.length) % toggles.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = toggles.length - 1;
        break;
      case "Escape":
        event.preventDefault();
        setIsWrapMenuOpen(false);
        wrapTriggerRef.current?.focus();
        return;
      case "Tab":
        setIsWrapMenuOpen(false);
        return;
      default:
        return;
    }

    event.preventDefault();
    wrapItemRefs.current[nextIndex]?.focus();
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
            <form
              className="view-create-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveFlag();
              }}
            >
              <input
                autoFocus
                aria-label="New flag name"
                value={flagName}
                maxLength={80}
                placeholder="Flag name"
                onChange={(event) => setFlagName(event.target.value)}
              />
              <button
                className="view-icon-button"
                type="submit"
                aria-label="Save flag"
                title={invalidFlagName ? "Use a unique letters, numbers, or underscores name" : "Save flag"}
                disabled={invalidFlagName}
              >
                <Check size={13} />
              </button>
              <button
                className="view-icon-button"
                type="button"
                aria-label="Cancel adding flag"
                title="Cancel"
                onClick={() => {
                  setFlagName("");
                  setIsAddingFlag(false);
                }}
              >
                <X size={13} />
              </button>
            </form>
          )}
        </div>
        <div className="view-controls">
          <div className="wrap-action-container">
            <button
              ref={wrapTriggerRef}
              className="wrap-action-trigger"
              type="button"
              aria-controls={isWrapMenuOpen ? wrapMenuId : undefined}
              aria-expanded={isWrapMenuOpen}
              aria-haspopup="menu"
              disabled={!canWrap}
              title={canWrap ? "Wrap selection with a live flag" : wrapUnavailableReason}
              onClick={() => setIsWrapMenuOpen((isOpen) => !isOpen)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && !isWrapMenuOpen) {
                  event.preventDefault();
                  setIsWrapMenuOpen(true);
                }
              }}
            >
              <span>Wrap selection</span>
              <ChevronDown size={12} aria-hidden="true" />
            </button>
            {isWrapMenuOpen && (
              <div
                ref={wrapMenuRef}
                className="wrap-action-menu"
                id={wrapMenuId}
                role="menu"
                aria-label="Wrap with live flag"
              >
                <div className="wrap-action-menu-title">Wrap with live flag</div>
                {toggles.map((toggle, index) => (
                  <button
                    ref={(item) => {
                      wrapItemRefs.current[index] = item;
                    }}
                    className="wrap-action-menu-item"
                    key={toggle.name}
                    type="button"
                    role="menuitem"
                    onClick={() => wrapWithToggle(toggle.name)}
                    onKeyDown={handleWrapMenuKeyDown}
                  >
                    <span className="wrap-action-menu-name">{toggle.label}</span>
                    <span
                      className={`wrap-action-menu-state ${
                        toggle.value ? "is-on" : "is-off"
                      }`}
                    >
                      {toggle.value ? "On" : "Off"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
