import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as library from './library-service'
import * as config from './config'
import { readAsDataUrl } from './assets'
import { buildLibrary } from './build-service'
import { templatePlatformArtPath } from './template'
import type { GamePatch, StudioConfig } from '../shared/types'

// Pasta de teste onde o pacote completo (switch/ + retroarch/) sai - só
// usado como sugestão inicial do diálogo de "Gerar", que sempre deixa
// escolher outro destino.
const DEFAULT_BUILD_DIR = 'C:\\Users\\Vini\\Desktop\\hakswtudio entregavel'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    minWidth: 1200,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('library:listGames', () => library.listGames())
  ipcMain.handle('library:listPlatforms', () => library.listPlatforms())
  ipcMain.handle('library:importPaths', (_event, paths: string[]) => library.importPaths(paths))
  // Alternativa ao arrastar-e-soltar via seletor nativo - o mesmo
  // mecanismo que já é usado para escolher capa/destino do build, então
  // não depende do drag-and-drop OLE do Windows entre o Explorer e a
  // janela do Electron (que não estava sendo entregue à janela). No
  // Windows, misturar 'openFile' e 'openDirectory' no mesmo diálogo faz
  // ele esconder os arquivos e só mostrar pastas - por isso dois modos
  // separados em vez de um diálogo combinado.
  ipcMain.handle('library:pickImportFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Escolha as ROMs'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return library.importPaths(result.filePaths)
  })
  ipcMain.handle('library:pickImportFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Escolha a pasta com ROMs'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return library.importPaths(result.filePaths)
  })
  ipcMain.handle('library:updateGame', (_event, id: number, patch: GamePatch) =>
    library.updateGame(id, patch)
  )
  ipcMain.handle('library:deleteGame', (_event, id: number) => library.deleteGame(id))
  ipcMain.handle('library:bulkUpdateGames', (_event, ids: number[], patch: GamePatch) =>
    library.bulkUpdateGames(ids, patch)
  )
  ipcMain.handle('library:bulkDeleteGames', (_event, ids: number[]) =>
    library.bulkDeleteGames(ids)
  )
  ipcMain.handle('library:scrapeGame', (_event, id: number) => library.scrapeGame(id))
  ipcMain.handle('library:scrapeMissing', () => library.scrapeMissing())
  ipcMain.handle('library:scrapeSelected', (_event, ids: number[]) =>
    library.scrapeSelected(ids)
  )
  ipcMain.handle('library:pickLocalCover', async (_event, id: number) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    return library.setLocalCover(id, result.filePaths[0])
  })
  ipcMain.handle('library:pickPlatformLogo', async (_event, id: number) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    return library.setPlatformArt(id, 'logo', result.filePaths[0])
  })
  ipcMain.handle('library:pickPlatformBackground', async (_event, id: number) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    return library.setPlatformArt(id, 'background', result.filePaths[0])
  })
  ipcMain.handle('library:getPlatformTemplateArt', (_event, platformName: string) => ({
    logo: templatePlatformArtPath(platformName, 'logo'),
    background: templatePlatformArtPath(platformName, 'background')
  }))
  ipcMain.handle('config:get', () => config.getConfig())
  ipcMain.handle('config:set', (_event, patch: Partial<StudioConfig>) => config.setConfig(patch))

  ipcMain.handle('assets:readAsDataUrl', (_event, path: string) => readAsDataUrl(path))

  ipcMain.handle('build:generate', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Escolha onde gerar o pacote completo (switch/ + retroarch/)',
      defaultPath: existsSync(DEFAULT_BUILD_DIR) ? DEFAULT_BUILD_DIR : undefined
    })
    if (result.canceled || !result.filePaths[0]) return null
    return buildLibrary(result.filePaths[0])
  })
  ipcMain.handle('build:openFolder', (_event, path: string) => shell.openPath(path))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
