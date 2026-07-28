import { app } from 'electron'
import { createHash } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import { getDb } from './db'
import * as scrapers from './scrapers'
import { NoProviderConfiguredError, QuotaExceededError } from './scrapers'
import type { GamePatch, Game, ImportResult, Platform, ScrapeResult } from '../shared/types'

// Nomes de plataforma têm que bater exatamente com o nome da pasta em
// consoles/ que o HakSwitch real espera - "Nintendo" e "Super Nintendo",
// não "NES"/"SNES" (ver schema.sql).
const EXTENSION_TO_PLATFORM: Record<string, string> = {
  '.nes': 'Nintendo',
  '.sfc': 'Super Nintendo',
  '.smc': 'Super Nintendo',
  '.md': 'Mega Drive',
  '.gen': 'Mega Drive',
  '.sms': 'Master System',
  '.gb': 'Game Boy',
  '.gbc': 'Game Boy Color',
  '.gba': 'Game Boy Advance',
  '.zip': 'Arcade',
  '.n64': 'Nintendo 64',
  '.z64': 'Nintendo 64',
  '.v64': 'Nintendo 64',
  '.iso': 'PlayStation',
  '.chd': 'PlayStation',
  '.cue': 'PlayStation'
}

// Tags de região usadas nas convenções de nomenclatura No-Intro/GoodTools,
// dentro dos parênteses do nome do arquivo (ex "Sonic (World) (Rev B)",
// "Super Bomberman 4 (J)"). Comparação sem diferenciar maiúsculas.
const REGION_TAGS: Record<string, string> = {
  usa: 'USA',
  u: 'USA',
  europe: 'Europe',
  e: 'Europe',
  japan: 'Japan',
  j: 'Japan',
  world: 'World',
  w: 'World',
  brazil: 'Brazil',
  b: 'Brazil',
  pal: 'PAL',
  ntsc: 'NTSC'
}

function extractParenTags(filePath: string): string[] {
  const base = basename(filePath, extname(filePath))
  return [...base.matchAll(/\(([^)]*)\)/g)].map((match) => match[1])
}

function regionFromFilename(filePath: string): string | null {
  for (const tag of extractParenTags(filePath)) {
    const region = REGION_TAGS[tag.trim().toLowerCase()]
    if (region) return region
  }
  return null
}

function titleFromFilename(filePath: string): string {
  const base = basename(filePath, extname(filePath))
  return base
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectFiles(path: string): string[] {
  const stat = statSync(path)
  if (stat.isFile()) return [path]
  if (!stat.isDirectory()) return []

  const results: string[] = []
  for (const entry of readdirSync(path)) {
    results.push(...collectFiles(join(path, entry)))
  }
  return results
}

export function listPlatforms(): Platform[] {
  return getDb().prepare('SELECT * FROM platforms ORDER BY name').all() as Platform[]
}

export function listGames(): Game[] {
  return getDb()
    .prepare(
      `SELECT games.*, platforms.name as platform_name
       FROM games JOIN platforms ON platforms.id = games.platform_id
       ORDER BY games.title`
    )
    .all() as Game[]
}

export function importPaths(paths: string[]): ImportResult {
  const db = getDb()
  const platforms = db.prepare('SELECT id, name FROM platforms').all() as Platform[]
  const platformIdByName = new Map(platforms.map((p) => [p.name, p.id]))

  const insert = db.prepare(
    'INSERT INTO games (title, filename, platform_id, region) VALUES (?, ?, ?, ?)'
  )
  const alreadyImported = db.prepare('SELECT 1 FROM games WHERE filename = ?')

  let imported = 0
  let skipped = 0

  const files = paths.flatMap(collectFiles)

  for (const file of files) {
    const platformName = EXTENSION_TO_PLATFORM[extname(file).toLowerCase()]
    const platformId = platformName ? platformIdByName.get(platformName) : undefined

    if (!platformId || alreadyImported.get(file)) {
      skipped++
      continue
    }

    insert.run(titleFromFilename(file), file, platformId, regionFromFilename(file))
    imported++
  }

  return { imported, skipped }
}

export function updateGame(id: number, patch: GamePatch): void {
  const fields = Object.keys(patch) as Array<keyof GamePatch>
  if (fields.length === 0) return

  const setClause = fields.map((field) => `${field} = ?`).join(', ')
  const values = fields.map((field) => patch[field])
  getDb()
    .prepare(`UPDATE games SET ${setClause} WHERE id = ?`)
    .run(...values, id)
}

export function deleteGame(id: number): void {
  getDb().prepare('DELETE FROM games WHERE id = ?').run(id)
}

export function bulkUpdateGames(ids: number[], patch: GamePatch): void {
  const db = getDb()
  const apply = db.transaction((gameIds: number[]) => {
    for (const id of gameIds) updateGame(id, patch)
  })
  apply(ids)
}

export function bulkDeleteGames(ids: number[]): void {
  const db = getDb()
  const apply = db.transaction((gameIds: number[]) => {
    for (const id of gameIds) deleteGame(id)
  })
  apply(ids)
}

function getGameById(id: number): Game | undefined {
  return getDb()
    .prepare(
      `SELECT games.*, platforms.name as platform_name
       FROM games JOIN platforms ON platforms.id = games.platform_id
       WHERE games.id = ?`
    )
    .get(id) as Game | undefined
}

async function downloadCover(url: string): Promise<string> {
  const coversDir = join(app.getPath('userData'), 'covers')
  if (!existsSync(coversDir)) mkdirSync(coversDir, { recursive: true })

  // Nome do arquivo baseado no hash da URL, nao no id do jogo - o id e um
  // rowid do SQLite que pode ser reaproveitado depois de excluir um jogo,
  // o que fazia um jogo novo herdar a capa antiga de um jogo ja excluido
  // que por acaso usou o mesmo id.
  const ext = extname(new URL(url).pathname) || '.jpg'
  const hash = createHash('sha1').update(url).digest('hex')
  const coverPath = join(coversDir, `${hash}${ext}`)

  if (existsSync(coverPath)) return coverPath

  const response = await fetch(url)
  const buffer = Buffer.from(await response.arrayBuffer())
  writeFileSync(coverPath, buffer)
  return coverPath
}

export async function scrapeGame(id: number): Promise<boolean> {
  const game = getGameById(id)
  if (!game) return false

  const metadata = await scrapers.search(game.title, game.platform_name)
  if (!metadata) return false

  const cover = metadata.coverUrl ? await downloadCover(metadata.coverUrl) : null

  updateGame(id, {
    description: metadata.description,
    publisher: metadata.publisher,
    developer: metadata.developer,
    genre: metadata.genre,
    year: metadata.year,
    players: metadata.players,
    ...(cover ? { cover } : {})
  })

  return true
}

async function scrapeMany(ids: number[]): Promise<ScrapeResult> {
  let scraped = 0
  let failed = 0
  let quotaExceeded = false

  for (const id of ids) {
    try {
      const ok = await scrapeGame(id)
      if (ok) scraped++
      else failed++
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        quotaExceeded = true
        break
      }
      if (error instanceof NoProviderConfiguredError) {
        throw error
      }
      failed++
    }
  }

  return { scraped, failed, quotaExceeded }
}

export async function scrapeMissing(): Promise<ScrapeResult> {
  const pending = getDb()
    .prepare('SELECT id FROM games WHERE description IS NULL')
    .all() as Array<{ id: number }>

  return scrapeMany(pending.map((row) => row.id))
}

export async function scrapeSelected(ids: number[]): Promise<ScrapeResult> {
  return scrapeMany(ids)
}

export function setLocalCover(id: number, sourcePath: string): string {
  const coversDir = join(app.getPath('userData'), 'covers')
  if (!existsSync(coversDir)) mkdirSync(coversDir, { recursive: true })

  const coverPath = join(coversDir, `${id}${extname(sourcePath)}`)
  copyFileSync(sourcePath, coverPath)
  updateGame(id, { cover: coverPath })
  return coverPath
}

export function setPlatformArt(
  id: number,
  field: 'logo' | 'background',
  sourcePath: string
): string {
  const artDir = join(app.getPath('userData'), 'platform-art')
  if (!existsSync(artDir)) mkdirSync(artDir, { recursive: true })

  const artPath = join(artDir, `${id}-${field}${extname(sourcePath)}`)
  copyFileSync(sourcePath, artPath)
  getDb().prepare(`UPDATE platforms SET ${field} = ? WHERE id = ?`).run(artPath, id)
  return artPath
}
