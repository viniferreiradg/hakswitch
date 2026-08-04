export interface Platform {
  id: number
  name: string
  logo: string | null
  background: string | null
}

export interface Game {
  id: number
  title: string
  filename: string
  platform_id: number
  platform_name: string
  cover: string | null
  logo: string | null
  video: string | null
  background: string | null
  description: string | null
  publisher: string | null
  developer: string | null
  genre: string | null
  year: number | null
  region: string | null
  players: number | null
  favorite: number
  play_count: number
  last_played: string | null
  category_path: string | null
}

export interface ImportResult {
  imported: number
  skipped: number
}

export interface ScrapeResult {
  scraped: number
  failed: number
  quotaExceeded: boolean
}

export interface BuildResult {
  included: number
  missingFiles: number
  // false = pasta do projeto HakSwitch (nro/cores/sfx/música) não foi
  // encontrada nessa máquina - só consoles/ foi gerado, sem o resto.
  templateFound: boolean
  outputPath: string
}

export type GamePatch = Partial<
  Pick<
    Game,
    | 'title'
    | 'platform_id'
    | 'category_path'
    | 'favorite'
    | 'cover'
    | 'logo'
    | 'description'
    | 'publisher'
    | 'developer'
    | 'genre'
    | 'year'
    | 'region'
    | 'players'
  >
>

export interface LibraryApi {
  listGames(): Promise<Game[]>
  listPlatforms(): Promise<Platform[]>
  importPaths(paths: string[]): Promise<ImportResult>
  pickImportFiles(): Promise<ImportResult | null>
  pickImportFolder(): Promise<ImportResult | null>
  updateGame(id: number, patch: GamePatch): Promise<void>
  deleteGame(id: number): Promise<void>
  bulkUpdateGames(ids: number[], patch: GamePatch): Promise<void>
  bulkDeleteGames(ids: number[]): Promise<void>
  scrapeGame(id: number): Promise<boolean>
  scrapeMissing(): Promise<ScrapeResult>
  scrapeSelected(ids: number[]): Promise<ScrapeResult>
  pickLocalCover(id: number): Promise<string | null>
  pickPlatformLogo(id: number): Promise<string | null>
  pickPlatformBackground(id: number): Promise<string | null>
  getPlatformTemplateArt(platformName: string): Promise<{ logo: string | null; background: string | null }>
}

export interface ConfigApi {
  get(): Promise<StudioConfig>
  set(patch: Partial<StudioConfig>): Promise<StudioConfig>
}

export interface BuildApi {
  generate(): Promise<BuildResult | null>
  generateTico(): Promise<BuildResult | null>
  openFolder(path: string): Promise<void>
}

export interface StudioConfig {
  thegamesdb_api_key: string
}
