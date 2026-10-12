/// <reference types="vite/client" />

import type { PiDesktopApi } from '../shared/types'

declare global {
  interface Window {
    piDesktop: PiDesktopApi
  }
}

export {}
