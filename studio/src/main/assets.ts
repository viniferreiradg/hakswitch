import { existsSync, readFileSync } from 'fs'
import { extname } from 'path'

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

// Le uma imagem local e devolve como data URL. Evitamos carregar file:// direto
// no renderer para nao depender de excecoes na CSP.
export function readAsDataUrl(path: string): string | null {
  if (!existsSync(path)) return null

  const mime = MIME_BY_EXTENSION[extname(path).toLowerCase()]
  if (!mime) return null

  const base64 = readFileSync(path).toString('base64')
  return `data:${mime};base64,${base64}`
}
