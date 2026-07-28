import { ElectronAPI } from '@electron-toolkit/preload'
import type { BuildApi, ConfigApi, LibraryApi } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getPathForFile: (file: File) => string
      readAsDataUrl: (path: string) => Promise<string | null>
      config: ConfigApi
      library: LibraryApi
      build: BuildApi
    }
  }
}
