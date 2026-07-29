import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Gamepad2, LayoutGrid, Search, Settings, Smartphone, Upload } from 'lucide-react'
import type { BuildResult, Game, ImportResult, Platform, ScrapeResult } from '../../shared/types'
import SettingsPanel from './SettingsPanel'
import LoadingOverlay from './LoadingOverlay'
import BuildSuccessModal from './BuildSuccessModal'

function formatScrapeResult(result: ScrapeResult): string {
  if (result.quotaExceeded) {
    return `Cota mensal do TheGamesDB esgotada. Encontrados: ${result.scraped} antes de parar.`
  }
  return `Metadados encontrados: ${result.scraped} - Não encontrados: ${result.failed}`
}

// lucide não tem ícones de marca por console - só os genéricos do guia
// (grid/lupa/engrenagem/upload/estrela). Portáteis (família Game Boy)
// usam um ícone diferente dos de cartucho/CD pra dar alguma distinção
// visual na sidebar sem inventar um ícone por plataforma.
function PlatformIcon({ name, size }: { name: string; size: number }): React.JSX.Element {
  if (name.startsWith('Game Boy')) return <Smartphone size={size} />
  return <Gamepad2 size={size} />
}

function SidebarItem({
  icon,
  label,
  count,
  selected,
  onClick
}: {
  icon: React.ReactNode
  label: string
  count: number
  selected: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex h-12 w-full items-center gap-3 rounded-button px-3 text-sm transition-colors ${
        selected
          ? 'bg-accent text-white'
          : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          selected ? 'bg-white/20' : 'bg-white/5 text-text-secondary'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

// Handle fino entre colunas - arrasta pra redimensionar, igual às colunas
// do Claude. onResize recebe o delta em X desde o último movimento (não o
// total), então quem chama só soma no width atual - mais simples que
// carregar largura inicial/posição do mouse pra cá.
function ResizeHandle({ onResize }: { onResize: (deltaX: number) => void }): React.JSX.Element {
  const handlePointerDown = (downEvent: React.PointerEvent<HTMLDivElement>): void => {
    downEvent.preventDefault()
    let lastX = downEvent.clientX

    const handleMove = (moveEvent: PointerEvent): void => {
      onResize(moveEvent.clientX - lastX)
      lastX = moveEvent.clientX
    }
    const handleUp = (): void => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      className="group relative w-2 shrink-0 cursor-col-resize"
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent group-hover:bg-accent" />
    </div>
  )
}

const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 440
const RIGHT_PANEL_MIN = 280
const RIGHT_PANEL_MAX = 520

function App(): React.JSX.Element {
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [rightPanelWidth, setRightPanelWidth] = useState(340)
  const [games, setGames] = useState<Game[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  // null = "Todos os jogos" - console é a navegação principal agora
  // (antes era uma árvore de categoria livre, que não refletia a
  // estrutura real do HakSwitch, organizado por console).
  const [selectedPlatformId, setSelectedPlatformId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const [formTitle, setFormTitle] = useState('')
  const [formPlatformId, setFormPlatformId] = useState(0)
  const [formCategoryPath, setFormCategoryPath] = useState('')
  const [formFavorite, setFormFavorite] = useState(false)
  const [formRegion, setFormRegion] = useState('')

  const [bulkCategoryPath, setBulkCategoryPath] = useState('')
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')

  const [showSettings, setShowSettings] = useState(false)
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null)
  const [isScraping, setIsScraping] = useState(false)
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null)

  const [isBuilding, setIsBuilding] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)

  const reload = useCallback(async () => {
    const [gamesResult, platformsResult] = await Promise.allSettled([
      window.api.library.listGames(),
      window.api.library.listPlatforms()
    ])
    if (gamesResult.status === 'fulfilled') setGames(gamesResult.value)
    else console.error('Falha ao carregar jogos', gamesResult.reason)
    if (platformsResult.status === 'fulfilled') setPlatforms(platformsResult.value)
    else console.error('Falha ao carregar plataformas', platformsResult.reason)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const gameCountByPlatform = useMemo(() => {
    const counts = new Map<number, number>()
    for (const game of games) counts.set(game.platform_id, (counts.get(game.platform_id) ?? 0) + 1)
    return counts
  }, [games])

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase()
    return games
      .filter((game) => selectedPlatformId === null || game.platform_id === selectedPlatformId)
      .filter((game) => !query || game.title.toLowerCase().includes(query))
  }, [games, selectedPlatformId, search])

  const selectedGames = useMemo(
    () => games.filter((game) => selectedIds.has(game.id)),
    [games, selectedIds]
  )
  const singleGame = selectedGames.length === 1 ? selectedGames[0] : null

  const categoryTitle =
    selectedPlatformId === null
      ? 'Todos os jogos'
      : (platforms.find((platform) => platform.id === selectedPlatformId)?.name ?? '')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (singleGame) {
      setFormTitle(singleGame.title)
      setFormPlatformId(singleGame.platform_id)
      setFormCategoryPath(singleGame.category_path ?? '')
      setFormFavorite(Boolean(singleGame.favorite))
      setFormRegion(singleGame.region ?? '')
    }
  }, [singleGame?.id])

  useEffect(() => {
    setCoverDataUrl(null)
    if (singleGame?.cover) {
      window.api.readAsDataUrl(singleGame.cover).then(setCoverDataUrl)
    }
  }, [singleGame?.cover])

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragging(false)

      const paths = Array.from(event.dataTransfer.files).map((file) =>
        window.api.getPathForFile(file)
      )
      if (paths.length === 0) return

      await afterImport(await window.api.library.importPaths(paths))
    },
    [reload]
  )

  const afterImport = async (result: ImportResult): Promise<void> => {
    setImportMessage(`Importados: ${result.imported} - Ignorados: ${result.skipped}`)
    await reload()

    if (result.imported > 0) {
      setIsScraping(true)
      setScrapeMessage('Buscando metadados...')
      try {
        setScrapeMessage(formatScrapeResult(await window.api.library.scrapeMissing()))
      } catch (error) {
        setScrapeMessage(error instanceof Error ? error.message : String(error))
      }
      setIsScraping(false)
      await reload()
    }
  }

  const pickFilesAndImport = async (): Promise<void> => {
    const result = await window.api.library.pickImportFiles()
    if (result) await afterImport(result)
  }

  const pickFolderAndImport = async (): Promise<void> => {
    const result = await window.api.library.pickImportFolder()
    if (result) await afterImport(result)
  }

  const scrapeAllPending = async (): Promise<void> => {
    setIsScraping(true)
    setScrapeMessage('Buscando metadados...')
    try {
      setScrapeMessage(formatScrapeResult(await window.api.library.scrapeMissing()))
    } catch (error) {
      setScrapeMessage(error instanceof Error ? error.message : String(error))
    }
    setIsScraping(false)
    await reload()
  }

  const scrapeSelectedGames = async (): Promise<void> => {
    setIsScraping(true)
    setScrapeMessage('Buscando metadados...')
    try {
      setScrapeMessage(
        formatScrapeResult(await window.api.library.scrapeSelected(Array.from(selectedIds)))
      )
    } catch (error) {
      setScrapeMessage(error instanceof Error ? error.message : String(error))
    }
    setIsScraping(false)
    await reload()
  }

  const scrapeSingle = async (): Promise<void> => {
    if (!singleGame) return
    setIsScraping(true)
    setScrapeMessage('Buscando metadados...')
    try {
      const found = await window.api.library.scrapeGame(singleGame.id)
      setScrapeMessage(found ? 'Metadados encontrados.' : 'Nenhum resultado encontrado.')
    } catch (error) {
      setScrapeMessage(error instanceof Error ? error.message : String(error))
    }
    setIsScraping(false)
    await reload()
  }

  const pickCoverForSingle = async (): Promise<void> => {
    if (!singleGame) return
    const cover = await window.api.library.pickLocalCover(singleGame.id)
    if (cover) await reload()
  }

  const generateLibrary = async (): Promise<void> => {
    setIsBuilding(true)
    setBuildError(null)
    try {
      const result = await window.api.build.generate()
      if (result) setBuildResult(result)
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : String(error))
    }
    setIsBuilding(false)
  }

  const handleRowClick = (
    game: Game,
    index: number,
    event: React.MouseEvent<HTMLDivElement>
  ): void => {
    if (event.shiftKey && lastClickedIndex !== null) {
      const [start, end] = [lastClickedIndex, index].sort((a, b) => a - b)
      const rangeIds = filteredGames.slice(start, end + 1).map((g) => g.id)
      setSelectedIds(new Set(rangeIds))
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(game.id)) next.delete(game.id)
        else next.add(game.id)
        return next
      })
      setLastClickedIndex(index)
    } else {
      setSelectedIds(new Set([game.id]))
      setLastClickedIndex(index)
    }
  }

  // Ctrl+A seleciona tudo que está filtrado na tela (não o total da
  // biblioteca) - setas navegam item a item, substituindo o scroll padrão
  // do navegador, que era o único efeito que as setas tinham antes. Ignora
  // as duas coisas quando o foco está num campo de texto (busca, título,
  // categoria, etc.) pra não atrapalhar digitação/seleção de texto normal.
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      const tag = (target as HTMLElement | null)?.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelectedIds(new Set(filteredGames.map((game) => game.id)))
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (filteredGames.length === 0) return
        event.preventDefault()

        const currentIndex = lastClickedIndex ?? 0
        const nextIndex = Math.min(
          filteredGames.length - 1,
          Math.max(0, currentIndex + (event.key === 'ArrowDown' ? 1 : -1))
        )
        const nextGame = filteredGames[nextIndex]

        setSelectedIds(new Set([nextGame.id]))
        setLastClickedIndex(nextIndex)
        rowRefs.current.get(nextGame.id)?.scrollIntoView({ block: 'nearest' })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredGames, lastClickedIndex])

  const saveSingleEdit = async (): Promise<void> => {
    if (!singleGame) return
    await window.api.library.updateGame(singleGame.id, {
      title: formTitle,
      platform_id: formPlatformId,
      category_path: formCategoryPath.trim() || null,
      favorite: formFavorite ? 1 : 0,
      region: formRegion.trim() || null
    })
    await reload()
  }

  const deleteSingle = async (): Promise<void> => {
    if (!singleGame) return
    if (!window.confirm(`Excluir "${singleGame.title}"?`)) return
    await window.api.library.deleteGame(singleGame.id)
    setSelectedIds(new Set())
    await reload()
  }

  const applyBulkCategory = async (): Promise<void> => {
    await window.api.library.bulkUpdateGames(Array.from(selectedIds), {
      category_path: bulkCategoryPath.trim() || null
    })
    await reload()
  }

  const applyBulkRename = async (): Promise<void> => {
    if (!findText) return
    const targets = selectedGames.filter((game) => game.title.includes(findText))
    await Promise.all(
      targets.map((game) =>
        window.api.library.updateGame(game.id, {
          title: game.title.split(findText).join(replaceText)
        })
      )
    )
    setFindText('')
    setReplaceText('')
    await reload()
  }

  const deleteBulk = async (): Promise<void> => {
    if (!window.confirm(`Excluir ${selectedIds.size} jogos selecionados?`)) return
    await window.api.library.bulkDeleteGames(Array.from(selectedIds))
    setSelectedIds(new Set())
    await reload()
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-bg text-text-primary font-sans text-sm">
      {showSettings && (
        <SettingsPanel
          platforms={platforms}
          onClose={() => setShowSettings(false)}
          onPlatformsChanged={reload}
        />
      )}
      {isScraping && <LoadingOverlay message={scrapeMessage ?? 'Buscando metadados...'} />}
      {isBuilding && <LoadingOverlay message="Gerando biblioteca..." />}
      {buildResult && (
        <BuildSuccessModal result={buildResult} onClose={() => setBuildResult(null)} />
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside
        style={{ width: sidebarWidth }}
        className="m-2 flex shrink-0 flex-col gap-4 overflow-hidden rounded-sidebar bg-sidebar p-4"
      >
        <div className="flex items-center gap-2 px-1 text-lg font-bold">
          <LayoutGrid size={20} className="text-accent" />
          HakSwitch Studio
        </div>

        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-placeholder"
          />
          <input
            className="h-11 w-full rounded-input border border-border bg-input pl-9 pr-3 text-sm placeholder:text-placeholder focus:border-accent focus:outline-none"
            placeholder="Buscar por título..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          <SidebarItem
            icon={<LayoutGrid size={20} />}
            label="Todos os jogos"
            count={games.length}
            selected={selectedPlatformId === null}
            onClick={() => setSelectedPlatformId(null)}
          />
          {platforms.map((platform) => (
            <SidebarItem
              key={platform.id}
              icon={<PlatformIcon name={platform.name} size={20} />}
              label={platform.name}
              count={gameCountByPlatform.get(platform.id) ?? 0}
              selected={selectedPlatformId === platform.id}
              onClick={() => setSelectedPlatformId(platform.id)}
            />
          ))}
        </nav>
      </aside>

      <ResizeHandle
        onResize={(deltaX) =>
          setSidebarWidth((width) =>
            Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width + deltaX))
          )
        }
      />

      {/* Área central */}
      <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{categoryTitle}</h1>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-button p-2 text-text-secondary hover:bg-white/5 hover:text-text-primary"
          >
            <Settings size={20} />
          </button>
        </div>

        {buildError && (
          <div className="rounded-input bg-card px-4 py-2 text-red-400">{buildError}</div>
        )}

        <div
          className={`flex flex-col items-center gap-3 rounded-drop border-2 border-dashed p-6 text-center transition-colors ${
            isDragging ? 'border-accent bg-accent/5' : 'border-border'
          }`}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <Upload size={24} className="text-placeholder" />
          <span className="text-text-secondary">Arraste uma pasta com ROMs aqui para importar</span>
          <div className="flex gap-2">
            <button
              className="rounded-button border border-border px-4 py-2 text-sm hover:bg-white/5"
              onClick={(event) => {
                event.stopPropagation()
                pickFilesAndImport()
              }}
            >
              Escolher arquivos
            </button>
            <button
              className="rounded-button border border-border px-4 py-2 text-sm hover:bg-white/5"
              onClick={(event) => {
                event.stopPropagation()
                pickFolderAndImport()
              }}
            >
              Escolher pasta
            </button>
          </div>
        </div>

        {importMessage && (
          <div className="rounded-input bg-card px-4 py-2 text-text-secondary">
            {importMessage}
          </div>
        )}
        {scrapeMessage && (
          <div className="rounded-input bg-card px-4 py-2 text-text-secondary">
            {scrapeMessage}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-table bg-card p-2">
          <div className="flex items-center gap-4 px-4 py-2 text-xs text-text-secondary">
            <span className="flex-[2] min-w-0 truncate whitespace-nowrap">Título</span>
            <span className="flex-1 min-w-0 truncate whitespace-nowrap">Plataforma</span>
            <span className="flex-1 min-w-0 truncate whitespace-nowrap">Categoria</span>
            <span className="w-20 shrink-0 whitespace-nowrap">Região</span>
            <span className="w-16 shrink-0 whitespace-nowrap text-center">Favorito</span>
          </div>
          {filteredGames.map((game, index) => (
            <div
              key={game.id}
              ref={(el) => {
                if (el) rowRefs.current.set(game.id, el)
                else rowRefs.current.delete(game.id)
              }}
              onClick={(event) => handleRowClick(game, index, event)}
              className={`flex h-11 cursor-pointer items-center gap-4 rounded-button px-4 transition-colors hover:bg-white/5 ${
                selectedIds.has(game.id) ? 'bg-accent/15' : ''
              }`}
            >
              <span className="flex-[2] min-w-0 truncate font-medium">{game.title}</span>
              <span className="flex-1 min-w-0 truncate text-text-secondary">
                {game.platform_name}
              </span>
              <span className="flex-1 min-w-0 truncate text-text-secondary">
                {game.category_path ?? '-'}
              </span>
              <span className="w-20 shrink-0 text-text-secondary">{game.region ?? '-'}</span>
              <span className="w-16 shrink-0 text-center text-accent">
                {game.favorite ? '★' : ''}
              </span>
            </div>
          ))}
        </div>
      </main>

      <ResizeHandle
        onResize={(deltaX) =>
          setRightPanelWidth((width) =>
            Math.min(RIGHT_PANEL_MAX, Math.max(RIGHT_PANEL_MIN, width - deltaX))
          )
        }
      />

      {/* Painel direito */}
      <aside
        style={{ width: rightPanelWidth }}
        className="m-2 ml-0 shrink-0 overflow-y-auto overflow-x-hidden rounded-card bg-sidebar p-6"
      >
        {singleGame && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <button className="btn-primary btn-sm flex-1" onClick={saveSingleEdit}>
                Salvar
              </button>
              <button className="btn-secondary btn-sm flex-1" onClick={deleteSingle}>
                Excluir
              </button>
            </div>
            <div className="flex gap-2">
              <button
                disabled={isScraping}
                className="btn-secondary btn-sm flex-1"
                onClick={scrapeSingle}
              >
                Buscar metadados
              </button>
              <button className="btn-secondary btn-sm flex-1" onClick={pickCoverForSingle}>
                Escolher capa
              </button>
            </div>

            {coverDataUrl ? (
              <img
                className="mx-auto w-[220px] cursor-pointer rounded-[10px] object-cover transition-opacity hover:opacity-80"
                src={coverDataUrl}
                alt={singleGame.title}
                title="Clique para trocar a capa"
                onClick={pickCoverForSingle}
              />
            ) : (
              <div
                className="mx-auto flex h-[300px] w-[220px] cursor-pointer items-center justify-center rounded-[10px] bg-card text-4xl text-text-secondary transition-opacity hover:opacity-80"
                title="Clique para escolher uma capa"
                onClick={pickCoverForSingle}
              >
                {singleGame.title.slice(0, 1)}
              </div>
            )}
            <Field label="Título">
              <input
                className="field-input"
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
              />
            </Field>
            <Field label="Plataforma">
              <select
                className="field-input"
                value={formPlatformId}
                onChange={(event) => setFormPlatformId(Number(event.target.value))}
              >
                {platforms.map((platform) => (
                  <option key={platform.id} value={platform.id}>
                    {platform.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categoria">
              <input
                className="field-input"
                placeholder="ex: Nintendo/Mario"
                value={formCategoryPath}
                onChange={(event) => setFormCategoryPath(event.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#5b5ceb]"
                checked={formFavorite}
                onChange={(event) => setFormFavorite(event.target.checked)}
              />
              Favorito
            </label>
            <Field label="Região">
              <input
                className="field-input"
                placeholder="ex: USA, Japan, Europe"
                value={formRegion}
                onChange={(event) => setFormRegion(event.target.value)}
              />
            </Field>

            {singleGame.description && (
              <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
                <p className="text-text-secondary">{singleGame.description}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  {singleGame.publisher && (
                    <>
                      <dt className="text-text-secondary">Publisher</dt>
                      <dd>{singleGame.publisher}</dd>
                    </>
                  )}
                  {singleGame.developer && (
                    <>
                      <dt className="text-text-secondary">Desenvolvedora</dt>
                      <dd>{singleGame.developer}</dd>
                    </>
                  )}
                  {singleGame.genre && (
                    <>
                      <dt className="text-text-secondary">Gênero</dt>
                      <dd>{singleGame.genre}</dd>
                    </>
                  )}
                  {singleGame.year && (
                    <>
                      <dt className="text-text-secondary">Ano</dt>
                      <dd>{singleGame.year}</dd>
                    </>
                  )}
                  {singleGame.players && (
                    <>
                      <dt className="text-text-secondary">Jogadores</dt>
                      <dd>{singleGame.players}</dd>
                    </>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}

        {selectedGames.length > 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">{selectedGames.length} jogos selecionados</h2>
            <Field label="Mover para categoria">
              <input
                className="field-input"
                placeholder="ex: Nintendo/Mario"
                value={bulkCategoryPath}
                onChange={(event) => setBulkCategoryPath(event.target.value)}
              />
            </Field>
            <button className="btn-secondary" onClick={applyBulkCategory}>
              Aplicar categoria aos selecionados
            </button>

            <h3 className="border-t border-border pt-4 text-sm font-semibold">
              Renomear em lote
            </h3>
            <Field label="Buscar">
              <input
                className="field-input"
                value={findText}
                onChange={(event) => setFindText(event.target.value)}
              />
            </Field>
            <Field label="Substituir por">
              <input
                className="field-input"
                value={replaceText}
                onChange={(event) => setReplaceText(event.target.value)}
              />
            </Field>
            <button className="btn-secondary" onClick={applyBulkRename}>
              Aplicar renomeação em lote
            </button>

            <button
              disabled={isScraping}
              className="btn-secondary"
              onClick={scrapeSelectedGames}
            >
              Buscar metadados dos selecionados
            </button>
            <button className="btn-secondary" onClick={deleteBulk}>
              Excluir selecionados
            </button>
          </div>
        )}

        {selectedGames.length === 0 && (
          <div className="flex h-full items-center justify-center text-text-secondary">
            Selecione um jogo
          </div>
        )}
      </aside>
      </div>

      {/* Barra fixa embaixo, largura total */}
      <footer className="flex shrink-0 items-center justify-between border-t border-border bg-sidebar px-6 py-3">
        <div className="flex gap-8">
          <div>
            <div className="text-xs text-text-secondary">Total de jogos</div>
            <div className="text-lg font-bold">{games.length}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">Plataformas</div>
            <div className="text-lg font-bold">{platforms.length}</div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            disabled={isScraping}
            onClick={scrapeAllPending}
            className="btn-secondary"
          >
            Buscar metadados pendentes
          </button>
          <button disabled={isBuilding} onClick={generateLibrary} className="btn-primary">
            Gerar Biblioteca
          </button>
        </div>
      </footer>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
      {label}
      {children}
    </label>
  )
}

export default App
