/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "enabled" switches import and export on in this build; they are paused otherwise (D59). */
  readonly VITE_FILE_TRANSFERS?: string;
}
