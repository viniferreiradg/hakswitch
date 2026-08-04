import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  BuildResult,
  Game,
  GamePatch,
  ImportResult,
  Platform,
  ScrapeResult,
  StudioConfig
} from '../shared/types'

// Custom APIs for renderer
const api = {
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  readAsDataUrl: (path: string): Promise<string | null> =>
    ipcRenderer.invoke('assets:readAsDataUrl', path),
  config: {
    get: (): Promise<StudioConfig> => ipcRenderer.invoke('config:get'),
    set: (patch: Partial<StudioConfig>): Promise<StudioConfig> =>
      ipcRenderer.invoke('config:set', patch)
  },
  build: {
    generate: (): Promise<BuildResult | null> => ipcRenderer.invoke('build:generate'),
    generateTico: (): Promise<BuildResult | null> => ipcRenderer.invoke('build:generateTico'),
    openFolder: (path: string): Promise<void> => ipcRenderer.invoke('build:openFolder', path)
  },
  library: {
    listGames: (): Promise<Game[]> => ipcRenderer.invoke('library:listGames'),
    listPlatforms: (): Promise<Platform[]> => ipcRenderer.invoke('library:listPlatforms'),
    importPaths: (paths: string[]): Promise<ImportResult> =>
      ipcRenderer.invoke('library:importPaths', paths),
    pickImportFiles: (): Promise<ImportResult | null> =>
      ipcRenderer.invoke('library:pickImportFiles'),
    pickImportFolder: (): Promise<ImportResult | null> =>
      ipcRenderer.invoke('library:pickImportFolder'),
    updateGame: (id: number, patch: GamePatch): Promise<void> =>
      ipcRenderer.invoke('library:updateGame', id, patch),
    deleteGame: (id: number): Promise<void> => ipcRenderer.invoke('library:deleteGame', id),
    bulkUpdateGames: (ids: number[], patch: GamePatch): Promise<void> =>
      ipcRenderer.invoke('library:bulkUpdateGames', ids, patch),
    bulkDeleteGames: (ids: number[]): Promise<void> =>
      ipcRenderer.invoke('library:bulkDeleteGames', ids),
    scrapeGame: (id: number): Promise<boolean> => ipcRenderer.invoke('library:scrapeGame', id),
    scrapeMissing: (): Promise<ScrapeResult> => ipcRenderer.invoke('library:scrapeMissing'),
    scrapeSelected: (ids: number[]): Promise<ScrapeResult> =>
      ipcRenderer.invoke('library:scrapeSelected', ids),
    pickLocalCover: (id: number): Promise<string | null> =>
      ipcRenderer.invoke('library:pickLocalCover', id),
    pickPlatformLogo: (id: number): Promise<string | null> =>
      ipcRenderer.invoke('library:pickPlatformLogo', id),
    pickPlatformBackground: (id: number): Promise<string | null> =>
      ipcRenderer.invoke('library:pickPlatformBackground', id),
    getPlatformTemplateArt: (
      platformName: string
    ): Promise<{ logo: string | null; background: string | null }> =>
      ipcRenderer.invoke('library:getPlatformTemplateArt', platformName)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
