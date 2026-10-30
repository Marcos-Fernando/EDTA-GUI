/// <reference types="vite/client" />

/** Injected by vite.config.ts (package.json version). */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string
  /** Backend origin, e.g. http://127.0.0.1:8000. Empty = same origin (Vite proxy). */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
