import { useEffect, useState } from 'react'
import type { Platform } from '../../shared/types'
import PlatformArtList from './PlatformArtList'

interface SettingsPanelProps {
  platforms: Platform[]
  onClose: () => void
  onPlatformsChanged: () => Promise<void>
}

function ApiKeyTab(): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.config.get().then((config) => setApiKey(config.thegamesdb_api_key))
  }, [])

  const save = async (): Promise<void> => {
    await window.api.config.set({ thegamesdb_api_key: apiKey })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
        API key do TheGamesDB
        <input
          className="field-input"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </label>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" onClick={save}>
          Salvar
        </button>
      </div>
      {saved && <div className="mt-2 text-sm text-text-secondary">Salvo.</div>}
    </>
  )
}

function SettingsPanel({
  platforms,
  onClose,
  onPlatformsChanged
}: SettingsPanelProps): React.JSX.Element {
  const [tab, setTab] = useState<'api' | 'art'>('api')

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-[480px] flex-col gap-4 overflow-y-auto rounded-card bg-card p-5 shadow-soft"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Configurações</h2>
        <div className="flex gap-1 border-b border-border pb-2">
          <button
            onClick={() => setTab('api')}
            className={`rounded-button px-3 py-1.5 text-sm ${
              tab === 'api' ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:bg-white/5'
            }`}
          >
            TheGamesDB
          </button>
          <button
            onClick={() => setTab('art')}
            className={`rounded-button px-3 py-1.5 text-sm ${
              tab === 'art' ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:bg-white/5'
            }`}
          >
            Arte dos Consoles
          </button>
        </div>

        {tab === 'api' ? (
          <ApiKeyTab />
        ) : (
          <PlatformArtList platforms={platforms} onChanged={onPlatformsChanged} />
        )}

        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
