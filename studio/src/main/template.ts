import { existsSync, readdirSync } from 'fs'
import { join } from 'path'

// Pasta do projeto HakSwitch já funcionando - fonte de tudo que é
// estático/igual em toda geração (ver build-service.ts). Também usada
// aqui só pra saber se um console já tem logo/fundo colocado à mão lá,
// pra não pedir pro usuário escolher de novo algo que já existe.
// TODO: se o Studio um dia rodar em outra máquina, isso vira uma
// configuração em vez de caminho fixo.
export const TEMPLATE_DIR = 'C:\\Users\\Vini\\dev\\hakswitch\\template\\local-data'

export function templatePlatformArtPath(
  platformName: string,
  field: 'logo' | 'background'
): string | null {
  const dir = join(TEMPLATE_DIR, 'consoles', platformName, field)
  if (!existsSync(dir)) return null

  const files = readdirSync(dir)
  return files.length > 0 ? join(dir, files[0]) : null
}
