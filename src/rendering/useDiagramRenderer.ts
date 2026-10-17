import { useCallback, useEffect, useRef, useState } from "react";
import type { RenderStatus } from "../components/AppHeader";
import {
  plantUmlRenderer,
  type RenderResult,
  type PlantUmlDiagnostic,
} from "./plantumlRenderer";

interface RenderRequest {
  source: string;
  identity: string | null;
  renderId: number;
}

interface AcceptedRender {
  source: string;
  identity: string | null;
  renderId: number;
}

const NO_DIAGNOSTICS: PlantUmlDiagnostic[] = [];

export function useDiagramRenderer(
  source: string | null,
  identity: string | null = source,
) {
  const [diagnosticState, setDiagnosticState] = useState<{
    source: string;
    identity: string | null;
    diagnostics: PlantUmlDiagnostic[];
  } | null>(null);
  const [svg, setSvg] = useState("");
  const [renderRevision, setRenderRevision] = useState(0);
  const [acceptedRender, setAcceptedRender] = useState<AcceptedRender | null>(
    null,
  );
  const [status, setStatus] = useState<RenderStatus>({
    kind: "initializing",
    label: "Loading engine",
  });
  const hasSvgRef = useRef(false);
  const renderIdRef = useRef(0);
  const latestAcceptedRef = useRef(0);
  const renderingRef = useRef(false);
  const pendingRef = useRef<RenderRequest | null>(null);
  const mountedRef = useRef(true);
  const runRequestRef = useRef<(request: RenderRequest) => void>(() => {});

  const acceptResult = useCallback(
    (result: RenderResult, source: string, identity: string | null) => {
      if (!mountedRef.current) return;
      if (
        result.renderId !== renderIdRef.current ||
        result.renderId < latestAcceptedRef.current
      ) {
        return;
      }
      latestAcceptedRef.current = result.renderId;
      setDiagnosticState({
        source,
        identity,
        diagnostics: !result.ok && result.diagnostic ? [result.diagnostic] : [],
      });

      if (result.ok) {
        hasSvgRef.current = true;
        setSvg(result.svg);
        setRenderRevision((revision) => revision + 1);
        setAcceptedRender({ source, identity, renderId: result.renderId });
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
    },
    [],
  );

  const runRequest = useCallback(
    (request: RenderRequest) => {
      renderingRef.current = true;
      void Promise.resolve()
        .then(() => plantUmlRenderer.render(request.source, request.renderId))
        .then(
          (result) => acceptResult(result, request.source, request.identity),
          (error: unknown) =>
            acceptResult(
              {
                ok: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Unable to render this diagram.",
                renderId: request.renderId,
                durationMs: 0,
              },
              request.source,
              request.identity,
            ),
        )
        .finally(() => {
          renderingRef.current = false;
          const pending = pendingRef.current;
          pendingRef.current = null;
          if (pending && mountedRef.current) runRequestRef.current(pending);
        });
    },
    [acceptResult],
  );
  runRequestRef.current = runRequest;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingRef.current = null;
    };
  }, []);

  useEffect(() => {
    setDiagnosticState(null);
    if (source === null) {
      if (renderIdRef.current > 0) ++renderIdRef.current;
      pendingRef.current = null;
      return;
    }
    pendingRef.current = null;

    const request = {
      source,
      identity,
      renderId: ++renderIdRef.current,
    };
    const hasSvg = hasSvgRef.current;
    setStatus((current) =>
      hasSvg
        ? { kind: "rendering", label: "Rendering changes" }
        : current.kind === "initializing"
          ? current
          : { kind: "rendering", label: "Rendering diagram" },
    );

    const timeout = window.setTimeout(() => {
      setStatus({
        kind: "rendering",
        label: hasSvgRef.current ? "Rendering changes" : "Rendering diagram",
      });
      if (renderingRef.current) {
        pendingRef.current = request;
      } else {
        runRequestRef.current(request);
      }
    }, hasSvg ? 300 : 0);

    return () => window.clearTimeout(timeout);
  }, [source, identity]);

  const diagnostics =
    diagnosticState?.source === source && diagnosticState.identity === identity
      ? diagnosticState.diagnostics
      : NO_DIAGNOSTICS;
  return { svg, renderRevision, acceptedRender, status, diagnostics };
}
