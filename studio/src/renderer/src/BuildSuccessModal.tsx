import { Check } from 'lucide-react'
import type { BuildResult } from '../../shared/types'

interface BuildSuccessModalProps {
  result: BuildResult
  onClose: () => void
}

function BuildSuccessModal({ result, onClose }: BuildSuccessModalProps): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex w-[400px] flex-col items-center gap-2 rounded-card bg-card p-8 text-center shadow-soft"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check size={28} />
        </div>
        <h2 className="text-lg font-bold">Biblioteca gerada com sucesso!</h2>
        <p className="text-sm">
          {result.included} jogos incluídos
          {result.missingFiles > 0 && `, ${result.missingFiles} com arquivo ausente`}
        </p>
        {!result.templateFound && (
          <p className="text-sm text-amber-400">
            Pasta do projeto HakSwitch não encontrada nessa máquina - só consoles/ foi gerado,
            sem o .nro/cores/sfx/música.
          </p>
        )}
        <p className="text-sm text-text-secondary">{result.outputPath}</p>
        <div className="mt-3 flex gap-2">
          <button
            className="btn-secondary"
            onClick={() => window.api.build.openFolder(result.outputPath)}
          >
            Abrir pasta
          </button>
          <button className="btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

export default BuildSuccessModal
