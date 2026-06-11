import { useCallback, useEffect, useRef, useState } from "react";
import type { RenderStatus } from "../components/AppHeader";
import { downloadPng } from "./diagramExporter";
import {
  plantUmlRenderer,
  type RenderResult,
} from "./plantumlRenderer";

export function useDiagramRenderer(source: string) {
  const [svg, setSvg] = useState("");
  const [renderRevision, setRenderRevision] = useState(0);
  const [status, setStatus] = useState<RenderStatus>({
    kind: "initializing",
    label: "Loading engine",
  });
  const hasSvgRef = useRef(false);
  const renderIdRef = useRef(0);
  const latestAcceptedRef = useRef(0);

  const acceptResult = useCallback((result: RenderResult) => {
    if (
      result.renderId !== renderIdRef.current ||
      result.renderId < latestAcceptedRef.current
    ) {
      return;
    }
    latestAcceptedRef.current = result.renderId;

    if (result.ok) {
      hasSvgRef.current = true;
      setSvg(result.svg);
      setRenderRevision((revision) => revision + 1);
      setStatus({
        kind: "success",
        label: `Rendered in ${Math.round(result.durationMs)} ms`,
      });
    } else {
      setStatus({
        kind: "error",
        label: result.error || "Unable to render this diagram.",
      });
    }
  }, []);

  useEffect(() => {
    const renderId = ++renderIdRef.current;
    const hasSvg = hasSvgRef.current;
    setStatus((current) =>
      hasSvg
        ? { kind: "rendering", label: "Rendering changes" }
        : current.kind === "initializing"
          ? current
          : { kind: "rendering", label: "Rendering diagram" },
    );

    const timeout = window.setTimeout(() => {
      setStatus({ kind: "rendering", label: "Rendering diagram" });
      void plantUmlRenderer.render(source, renderId).then(acceptResult);
    }, hasSvg ? 300 : 0);

    return () => window.clearTimeout(timeout);
  }, [acceptResult, source]);

  const exportPng = useCallback(() => {
    void downloadPng(svg).catch((error: unknown) => {
      setStatus({
        kind: "error",
        label: error instanceof Error ? error.message : "Unable to export PNG.",
      });
    });
  }, [svg]);

  return { svg, renderRevision, status, exportPng };
}
