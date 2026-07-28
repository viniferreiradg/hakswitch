import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { StudioConfig } from '../shared/types'

const DEFAULT_CONFIG: StudioConfig = {
  thegamesdb_api_key: ''
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

export function getConfig(): StudioConfig {
  const path = configPath()
  if (!existsSync(path)) return { ...DEFAULT_CONFIG }

  const stored = JSON.parse(readFileSync(path, 'utf-8'))
  return { ...DEFAULT_CONFIG, ...stored }
}

export function setConfig(patch: Partial<StudioConfig>): StudioConfig {
  const next = { ...getConfig(), ...patch }
  writeFileSync(configPath(), JSON.stringify(next, null, 2))
  return next
}
