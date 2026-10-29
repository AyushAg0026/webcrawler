/// <reference types="vite/client" />

// Types for our own .env variables, so import.meta.env.VITE_USE_MOCK is typed.
interface ImportMetaEnv {
  readonly VITE_USE_MOCK: string;
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
