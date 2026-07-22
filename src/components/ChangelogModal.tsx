import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

interface ChangelogRelease {
  version: string;
  changes: string[];
}

interface ChangelogModalProps {
  releases: ChangelogRelease[];
  onClose: () => void;
}

export function ChangelogModal({
  releases,
  onClose,
}: ChangelogModalProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="changelog-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="changelog-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="changelog-modal-header">
          <div>
            <div className="changelog-modal-eyebrow">Release history</div>
            <h2 id={titleId}>Changelog</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="changelog-close"
            type="button"
            onClick={onClose}
            aria-label="Close changelog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="changelog-releases">
          {releases.map((release, index) => (
            <section className="changelog-release" key={release.version}>
              <div className="changelog-release-heading">
                <h3>Version {release.version}</h3>
                {index === 0 && <span>Current</span>}
              </div>
              <ul>
                {release.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
