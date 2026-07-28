export interface ScrapedMetadata {
  description: string | null
  publisher: string | null
  developer: string | null
  genre: string | null
  year: number | null
  players: number | null
  coverUrl: string | null
}

export interface ScraperProvider {
  name: string
  search(title: string, platformName: string): Promise<ScrapedMetadata | null>
}

export class NotConfiguredError extends Error {
  constructor(providerName: string) {
    super(`${providerName} não está configurado.`)
    this.name = 'NotConfiguredError'
  }
}

export class QuotaExceededError extends Error {
  constructor(providerName: string) {
    super(`Cota de ${providerName} esgotada.`)
    this.name = 'QuotaExceededError'
  }
}
