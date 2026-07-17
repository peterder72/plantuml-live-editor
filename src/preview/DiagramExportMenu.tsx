import { ChevronDown, Clipboard, Download } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { TextButton } from "../components/TextButton";
import {
  copyDiagram,
  deriveExportFileName,
  saveDiagram,
  type ExportBackground,
  type ExportFormat,
} from "../rendering/diagramExporter";

interface DiagramExportMenuProps {
  svg: string;
  sourceFileName: string;
}

export function DiagramExportMenu({
  svg,
  sourceFileName,
}: DiagramExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [background, setBackground] =
    useState<ExportBackground>("transparent");
  const [isWorking, setIsWorking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const fileName = deriveExportFileName(sourceFileName, format);

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !dialogRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 2_000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const openMenu = () => {
    setError("");
    setFeedback("");
    setIsOpen((open) => !open);
  };

  const runExport = async (action: "copy" | "save") => {
    setIsWorking(true);
    setError("");
    setFeedback("");
    try {
      const options = { format, background };
      if (action === "copy") {
        await copyDiagram(svg, options);
        setFeedback(`Copied ${format.toUpperCase()}`);
      } else {
        await saveDiagram(svg, options, fileName);
        setFeedback(`Saved ${fileName}`);
      }
      setIsOpen(false);
      triggerRef.current?.focus();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : `Unable to ${action} image.`,
      );
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="diagram-export">
      <TextButton
        ref={triggerRef}
        icon={<Download size={13} />}
        onClick={openMenu}
        disabled={!svg}
        title="Export diagram"
        aria-controls={isOpen ? dialogId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        Export
        <ChevronDown size={11} aria-hidden="true" />
      </TextButton>

      {isOpen && (
        <div
          ref={dialogRef}
          className="export-popover"
          id={dialogId}
          role="dialog"
          aria-label="Export diagram"
          tabIndex={-1}
        >
          <div className="export-popover-heading">Export diagram</div>

          <fieldset className="export-option-group">
            <legend>Format</legend>
            <div className="export-segmented-control">
              {(["png", "svg"] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name={`${dialogId}-format`}
                    value={value}
                    checked={format === value}
                    onChange={() => {
                      setFormat(value);
                      setError("");
                    }}
                  />
                  <span>{value.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="export-option-group">
            <legend>Background</legend>
            <div className="export-segmented-control">
              {(["transparent", "white"] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name={`${dialogId}-background`}
                    value={value}
                    checked={background === value}
                    onChange={() => {
                      setBackground(value);
                      setError("");
                    }}
                  />
                  <span>{value === "transparent" ? "Transparent" : "White"}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="export-file-name" title={fileName}>
            {fileName}
          </div>

          {error && (
            <div className="export-error" role="alert">
              {error}
            </div>
          )}

          <div className="export-actions">
            <button
              type="button"
              className="export-action-button is-secondary"
              disabled={isWorking}
              onClick={() => void runExport("copy")}
            >
              <Clipboard size={13} aria-hidden="true" />
              Copy image
            </button>
            <button
              type="button"
              className="export-action-button is-primary"
              disabled={isWorking}
              onClick={() => void runExport("save")}
            >
              <Download size={13} aria-hidden="true" />
              Save
            </button>
          </div>
        </div>
      )}

      <span className="export-feedback" aria-live="polite">
        {feedback}
      </span>
    </div>
  );
}
