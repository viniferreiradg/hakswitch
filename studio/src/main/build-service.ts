import { basename, extname, join } from 'path'
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import sharp from 'sharp'
import { listGames, listPlatforms } from './library-service'
import { TEMPLATE_DIR } from './template'
import type { BuildResult } from '../shared/types'

// Copiadas inteiras, do template pra dentro de retroarch/ na saída -
// nenhuma delas depende do banco de dados do Studio.
const STATIC_RETROARCH_DIRS = ['cores', 'sfx', 'music', 'assets', 'icons', 'src', 'info']

// Confirmado com log real de hardware (sdmc:/retroarch-log.txt, linhas
// [HAKSWITCH_PROFILE] gpu_upload): uma capa de 1080px de altura leva
// ~50ms pra subir pra GPU no Switch; a mesma capa redimensionada pra
// 500px + WEBP leva ~6-11ms - é a diferença entre travar a música ao
// carregar uma capa e não travar nada. O hakswitch (.nro) já sabe ler
// .webp desde a versão V1.0.00003.
const COVER_MAX_HEIGHT = 500
const COVER_WEBP_QUALITY = 85

async function processCoverImage(sourcePath: string, destPath: string): Promise<void> {
  await sharp(sourcePath)
    .resize({ height: COVER_MAX_HEIGHT, withoutEnlargement: true })
    .webp({ quality: COVER_WEBP_QUALITY })
    .toFile(destPath)
}

// Mesma ideia da capa (menos bytes = upload de textura mais rápido), mas SEM
// redimensionar - logo/fundo são arte de tela cheia do console (não do jogo),
// e um limite de altura como o da capa deixaria isso borrado. O ozone.c lê o
// primeiro arquivo que achar em logo/ e background/ (dir_list_new sem filtro
// de extensão), então o nome/extensão de saída não importa pra ele.
const ART_WEBP_QUALITY = 85

async function processArtImage(sourcePath: string, destPath: string): Promise<void> {
  if (extname(sourcePath).toLowerCase() === '.webp') {
    copyFileSync(sourcePath, destPath)
    return
  }
  await sharp(sourcePath).webp({ quality: ART_WEBP_QUALITY }).toFile(destPath)
}

// Converte cada imagem de uma pasta de arte (logo/ ou background/) pra webp,
// preservando o nome sem a extensão original. Usada tanto pra pasta do
// template (consoles montados à mão antes do Studio existir) quanto, se um
// dia passar a ter mais de um arquivo lá, pro caminho escolhido no Studio.
async function processArtDir(sourceDir: string, destDir: string): Promise<void> {
  for (const filename of readdirSync(sourceDir)) {
    const sourcePath = join(sourceDir, filename)
    const destPath = join(destDir, `${basename(filename, extname(filename))}.webp`)
    await processArtImage(sourcePath, destPath)
  }
}

// Escreve o mesmo esquema flat que hakswitch_json_extract_string (ozone.c
// no projeto do .nro) sabe ler - name/description/year/region, sempre
// como string. Sem aspas escapadas: o parser de lá é um extrator ad-hoc,
// não um parser JSON de verdade, então strings com aspas quebrariam a
// leitura no app - substituídas aqui em vez de escapadas.
function toSafeJsonString(value: string): string {
  return value.replace(/["\\]/g, '')
}

function writeGameMetadata(path: string, fields: Record<string, string>): void {
  const body = Object.entries(fields)
    .map(([key, value]) => `"${key}": "${toSafeJsonString(value)}"`)
    .join(', ')
  writeFileSync(path, `{${body}}\n`)
}

export async function buildLibrary(destParentDir: string): Promise<BuildResult> {
  // Sempre um pacote completo e limpo, como se o usuário não tivesse nada
  // ainda no Switch - apaga switch/ e retroarch/ inteiros antes de montar
  // de novo, em vez de só atualizar consoles/. Evita qualquer sobra de
  // uma geração anterior (jogo removido, core antigo, etc.).
  const switchDir = join(destParentDir, 'switch')
  const retroarchDir = join(destParentDir, 'retroarch')
  for (const dir of [switchDir, retroarchDir]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
  }

  const templateFound = existsSync(TEMPLATE_DIR)

  if (templateFound) {
    const nroPath = join(TEMPLATE_DIR, 'hakswitch.nro')
    if (existsSync(nroPath)) copyFileSync(nroPath, join(switchDir, 'hakswitch.nro'))

    for (const dir of STATIC_RETROARCH_DIRS) {
      const src = join(TEMPLATE_DIR, dir)
      if (existsSync(src)) cpSync(src, join(retroarchDir, dir), { recursive: true })
    }

    // Só existe hoje direto no cartão SD (editado à mão lá) - copiado se
    // alguém colocar uma cópia dentro da pasta do template também.
    const cfgPath = join(TEMPLATE_DIR, 'retroarch.cfg')
    if (existsSync(cfgPath)) copyFileSync(cfgPath, join(retroarchDir, 'retroarch.cfg'))
  }

  const consolesDir = join(retroarchDir, 'consoles')
  mkdirSync(consolesDir, { recursive: true })

  const platformByName = new Map(listPlatforms().map((platform) => [platform.name, platform]))
  const platformDirsReady = new Set<string>()

  let included = 0
  let missingFiles = 0

  for (const game of listGames()) {
    if (!existsSync(game.filename)) {
      missingFiles++
      continue
    }

    const platformDir = join(consolesDir, game.platform_name)
    if (!platformDirsReady.has(game.platform_name)) {
      for (const sub of ['roms', 'capas', 'screenshots', 'metadata', 'logo', 'background']) {
        mkdirSync(join(platformDir, sub), { recursive: true })
      }

      // Logo/fundo escolhidos na tela "Arte dos consoles" do Studio têm
      // prioridade; se o console ainda não tem nada configurado lá, cai
      // no que já existe na pasta do template (consoles já montados à
      // mão em sessões anteriores), em vez de sair vazio.
      const platform = platformByName.get(game.platform_name)
      for (const art of ['logo', 'background'] as const) {
        const studioArt = platform?.[art]
        if (studioArt && existsSync(studioArt)) {
          const destPath = join(platformDir, art, `${basename(studioArt, extname(studioArt))}.webp`)
          await processArtImage(studioArt, destPath)
        } else if (templateFound) {
          const templateArt = join(TEMPLATE_DIR, 'consoles', game.platform_name, art)
          if (existsSync(templateArt))
            await processArtDir(templateArt, join(platformDir, art))
        }
      }

      platformDirsReady.add(game.platform_name)
    }

    const romBasename = basename(game.filename)
    const romNoExt = basename(game.filename, extname(game.filename))

    copyFileSync(game.filename, join(platformDir, 'roms', romBasename))

    // O app real casa capa <-> jogo pelo nome do arquivo (ignorando
    // extensão) - a capa PRECISA sair com o mesmo nome da ROM, não o
    // nome que ela tinha ao ser baixada/escolhida. Sempre gerada como
    // .webp (ver processCoverImage) independente do formato de origem.
    if (game.cover && existsSync(game.cover)) {
      await processCoverImage(game.cover, join(platformDir, 'capas', `${romNoExt}.webp`))
    }

    writeGameMetadata(join(platformDir, 'metadata', `${romNoExt}.json`), {
      name: game.title,
      description: game.description ?? '',
      year: game.year ? String(game.year) : '',
      region: game.region ?? ''
    })

    included++
  }

  return { included, missingFiles, templateFound, outputPath: destParentDir }
}
