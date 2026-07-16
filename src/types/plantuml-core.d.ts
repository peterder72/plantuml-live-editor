declare module "@peterder72/plantuml-core" {
  export function renderToString(
    lines: string[],
    onSuccess: (svg: string) => void,
    onError: (error: string) => void,
    options?: { dark?: boolean },
  ): void;
}

declare module "@peterder72/plantuml-core/viz-global.js";

declare module "@peterder72/plantuml-core/viz-global.js?raw" {
  const source: string;
  export default source;
}
