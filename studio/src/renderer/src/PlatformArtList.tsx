import { useEffect, useState } from 'react'
import type { Platform } from '../../shared/types'

function PlatformArtRow({
  platform,
  onChanged
}: {
  platform: Platform
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  // Sem nada escolhido no Studio ainda (platform.logo/background nulos),
  // o "Gerar" cai no que já existe na pasta do projeto (consoles montados
  // à mão em sessões anteriores) - mostrado aqui também, senão consoles
  // que já têm arte de verdade aparecem como se estivessem vazios.
  const [templateLogo, setTemplateLogo] = useState<string | null>(null)
  const [templateBackground, setTemplateBackground] = useState<string | null>(null)

  useEffect(() => {
    if (platform.logo || platform.background) return
    window.api.library.getPlatformTemplateArt(platform.name).then((art) => {
      setTemplateLogo(art.logo)
      setTemplateBackground(art.background)
    })
  }, [platform.name, platform.logo, platform.background])

  useEffect(() => {
    setLogoUrl(null)
    const path = platform.logo ?? templateLogo
    if (path) window.api.readAsDataUrl(path).then(setLogoUrl)
  }, [platform.logo, templateLogo])

  useEffect(() => {
    setBackgroundUrl(null)
    const path = platform.background ?? templateBackground
    if (path) window.api.readAsDataUrl(path).then(setBackgroundUrl)
  }, [platform.background, templateBackground])

  const pickLogo = async (): Promise<void> => {
    const path = await window.api.library.pickPlatformLogo(platform.id)
    if (path) await onChanged()
  }

  const pickBackground = async (): Promise<void> => {
    const path = await window.api.library.pickPlatformBackground(platform.id)
    if (path) await onChanged()
  }

  return (
    <div className="flex items-center gap-3 border-t border-border pt-3">
      {backgroundUrl ? (
        <img className="h-9 w-16 shrink-0 rounded-input bg-input object-cover" src={backgroundUrl} alt="" />
      ) : (
        <div className="h-9 w-16 shrink-0 rounded-input bg-input" />
      )}
      <div className="flex flex-1 flex-col gap-1.5">
        <h3 className="text-sm font-semibold">{platform.name}</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-14 text-text-secondary">Logo</span>
          {logoUrl && (
            <img className="h-9 w-16 rounded-input bg-input object-cover" src={logoUrl} alt="" />
          )}
          <button className="btn-secondary !h-8 !px-3 !text-xs" onClick={pickLogo}>
            Escolher logo
          </button>
          {!platform.logo && templateLogo && (
            <span className="text-text-secondary">já tem, do projeto</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-14 text-text-secondary">Fundo</span>
          <button className="btn-secondary !h-8 !px-3 !text-xs" onClick={pickBackground}>
            Escolher fundo
          </button>
          {!platform.background && templateBackground && (
            <span className="text-text-secondary">já tem, do projeto</span>
          )}
        </div>
      </div>
    </div>
  )
}

interface PlatformArtListProps {
  platforms: Platform[]
  onChanged: () => Promise<void>
}

function PlatformArtList({ platforms, onChanged }: PlatformArtListProps): React.JSX.Element {
  return (
    <>
      <p className="text-sm text-text-secondary">
        Logo e fundo usados no carrossel principal do HakSwitch. Escolher aqui substitui o que já
        existe na pasta do projeto para aquele console na próxima vez que gerar.
      </p>
      {platforms.map((platform) => (
        <PlatformArtRow key={platform.id} platform={platform} onChanged={onChanged} />
      ))}
    </>
  )
}

export default PlatformArtList
