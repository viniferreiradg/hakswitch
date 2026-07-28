import { getConfig } from '../config'
import { NotConfiguredError, QuotaExceededError } from './types'
import type { ScrapedMetadata, ScraperProvider } from './types'

const PROVIDER_NAME = 'TheGamesDB'
const BASE_URL = 'https://api.thegamesdb.net/v1'

// Nome da nossa plataforma -> trecho que deve aparecer no nome da plataforma
// na TheGamesDB (a busca e por substring, nao id fixo, porque os ids da TGDB
// nao sao garantidos estaveis o suficiente pra hardcodar com confianca).
const PLATFORM_NAME_HINTS: Record<string, string> = {
  NES: 'Nintendo Entertainment System',
  SNES: 'Super Nintendo',
  'Mega Drive': 'Genesis',
  'Game Boy Advance': 'Game Boy Advance',
  Arcade: 'Arcade',
  'Nintendo 64': 'Nintendo 64',
  PlayStation: 'Sony Playstation'
}

interface TgdbListCache {
  platforms: Map<string, number> | null
  genres: Map<number, string> | null
  publishers: Map<number, string> | null
  developers: Map<number, string> | null
}

const cache: TgdbListCache = {
  platforms: null,
  genres: null,
  publishers: null,
  developers: null
}

async function fetchJson(apiKey: string, path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('apikey', apiKey)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const response = await fetch(url)
  if (response.status === 429 || response.status === 403) {
    throw new QuotaExceededError(PROVIDER_NAME)
  }
  if (!response.ok) {
    throw new Error(`TheGamesDB respondeu ${response.status} em ${path}`)
  }

  const json = await response.json()
  if (json.remaining_monthly_allowance === 0) {
    throw new QuotaExceededError(PROVIDER_NAME)
  }
  return json
}

async function getPlatformsMap(apiKey: string): Promise<Map<string, number>> {
  if (cache.platforms) return cache.platforms

  const json = await fetchJson(apiKey, '/Platforms', {})
  const byId = json.data.platforms as Record<string, { id: number; name: string }>

  const map = new Map<string, number>()
  for (const [ourName, hint] of Object.entries(PLATFORM_NAME_HINTS)) {
    const match = Object.values(byId).find((platform) =>
      platform.name.toLowerCase().includes(hint.toLowerCase())
    )
    if (match) map.set(ourName, match.id)
  }

  cache.platforms = map
  return map
}

async function getIdNameMap(
  apiKey: string,
  path: string,
  dataKey: string
): Promise<Map<number, string>> {
  const json = await fetchJson(apiKey, path, {})
  const byId = json.data[dataKey] as Record<string, { id: number; name: string }>
  return new Map(Object.values(byId).map((entry) => [entry.id, entry.name]))
}

async function getGenresMap(apiKey: string): Promise<Map<number, string>> {
  if (!cache.genres) cache.genres = await getIdNameMap(apiKey, '/Genres', 'genres')
  return cache.genres
}

async function getPublishersMap(apiKey: string): Promise<Map<number, string>> {
  if (!cache.publishers) cache.publishers = await getIdNameMap(apiKey, '/Publishers', 'publishers')
  return cache.publishers
}

async function getDevelopersMap(apiKey: string): Promise<Map<number, string>> {
  if (!cache.developers) cache.developers = await getIdNameMap(apiKey, '/Developers', 'developers')
  return cache.developers
}

// A API as vezes devolve resultados fora de ordem de relevancia (ex: filtro de
// plataforma nao bateu, ou busca por substring solta) - sem isso, o primeiro
// resultado podia ser um jogo completamente diferente do buscado.
function pickBestMatch(games: any[], title: string): any {
  const normalizedQuery = title.toLowerCase().trim()
  const exact = games.find(
    (candidate) => String(candidate.game_title ?? '').toLowerCase().trim() === normalizedQuery
  )
  if (exact) return exact

  const partial = games.find((candidate) =>
    String(candidate.game_title ?? '').toLowerCase().includes(normalizedQuery)
  )
  return partial ?? games[0]
}

async function search(title: string, platformName: string): Promise<ScrapedMetadata | null> {
  const apiKey = getConfig().thegamesdb_api_key
  if (!apiKey) throw new NotConfiguredError(PROVIDER_NAME)

  const [platforms, genres, publishers, developers] = await Promise.all([
    getPlatformsMap(apiKey),
    getGenresMap(apiKey),
    getPublishersMap(apiKey),
    getDevelopersMap(apiKey)
  ])

  const platformId = platforms.get(platformName)
  const params: Record<string, string> = {
    name: title,
    fields: 'players,publishers,genres,overview,developers',
    include: 'boxart'
  }
  if (platformId) params['filter[platform]'] = String(platformId)

  const json = await fetchJson(apiKey, '/Games/ByGameName', params)
  const games = json.data?.games as any[]
  if (!games || games.length === 0) return null

  const game = pickBestMatch(games, title)

  const boxartData = json.include?.boxart?.data?.[game.id] as
    | Array<{ side: string; filename: string }>
    | undefined
  const baseUrl = json.include?.boxart?.base_url?.large as string | undefined
  const front = boxartData?.find((art) => art.side === 'front')
  const coverUrl = front && baseUrl ? `${baseUrl}${front.filename}` : null

  return {
    description: game.overview ?? null,
    publisher: game.publishers?.length ? (publishers.get(game.publishers[0]) ?? null) : null,
    developer: game.developers?.length ? (developers.get(game.developers[0]) ?? null) : null,
    genre: game.genres?.length ? (genres.get(game.genres[0]) ?? null) : null,
    year: game.release_date ? Number(String(game.release_date).slice(0, 4)) || null : null,
    players: game.players ?? null,
    coverUrl
  }
}

export const provider: ScraperProvider = { name: PROVIDER_NAME, search }
