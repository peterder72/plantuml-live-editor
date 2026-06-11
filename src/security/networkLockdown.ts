const BLOCKED_MESSAGE =
  "Network access is disabled by PlantUML Live Editor's privacy policy.";

function blockedApi(name: string): never {
  throw new Error(`${BLOCKED_MESSAGE} (${name})`);
}

export function installNetworkLockdown(): void {
  globalThis.fetch = (() => blockedApi("fetch")) as typeof fetch;
  globalThis.XMLHttpRequest = class {
    constructor() {
      blockedApi("XMLHttpRequest");
    }
  } as unknown as typeof XMLHttpRequest;
  globalThis.WebSocket = class {
    constructor() {
      blockedApi("WebSocket");
    }
  } as unknown as typeof WebSocket;
  globalThis.EventSource = class {
    constructor() {
      blockedApi("EventSource");
    }
  } as unknown as typeof EventSource;
  globalThis.Worker = class {
    constructor() {
      blockedApi("Worker");
    }
  } as unknown as typeof Worker;
  globalThis.SharedWorker = class {
    constructor() {
      blockedApi("SharedWorker");
    }
  } as unknown as typeof SharedWorker;
  Object.defineProperty(globalThis, "WebTransport", {
    configurable: false,
    writable: false,
    value: class {
      constructor() {
        blockedApi("WebTransport");
      }
    },
  });

  Object.defineProperty(Navigator.prototype, "sendBeacon", {
    configurable: false,
    writable: false,
    value: () => blockedApi("sendBeacon"),
  });

  if ("serviceWorker" in Navigator.prototype) {
    try {
      Object.defineProperty(Navigator.prototype, "serviceWorker", {
        configurable: false,
        get: () => undefined,
      });
    } catch {
      // CSP also blocks workers if this browser does not allow replacement.
    }
  }

  window.open = (() => blockedApi("window.open")) as typeof window.open;
}
