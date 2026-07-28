import { provider as theGamesDbProvider } from './thegamesdb'
import { NotConfiguredError, QuotaExceededError } from './types'
import type { ScrapedMetadata, ScraperProvider } from './types'

export { QuotaExceededError } from './types'

export class NoProviderConfiguredError extends Error {
  constructor() {
    super('Nenhum provedor de scraping configurado. Configure ao menos um em Configurações.')
    this.name = 'NoProviderConfiguredError'
  }
}

// Ordem de prioridade. Para adicionar um novo provedor (ex: IGDB), crie um
// modulo implementando ScraperProvider e inclua aqui.
const PROVIDERS: ScraperProvider[] = [theGamesDbProvider]

export async function search(title: string, platformName: string): Promise<ScrapedMetadata | null> {
  let anyConfigured = false
  let anyQuotaExceeded = false

  for (const provider of PROVIDERS) {
    try {
      const result = await provider.search(title, platformName)
      anyConfigured = true
      if (result) return result
    } catch (error) {
      if (error instanceof NotConfiguredError) continue
      if (error instanceof QuotaExceededError) {
        anyQuotaExceeded = true
        continue
      }
      throw error
    }
  }

  if (!anyConfigured) {
    throw new NoProviderConfiguredError()
  }
  if (anyQuotaExceeded) {
    throw new QuotaExceededError('provedores de scraping')
  }
  return null
}
