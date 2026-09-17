/// <reference types="vite/client" />

declare module "*.png?inline" {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
  readonly VITE_ANDROID_DOWNLOAD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
