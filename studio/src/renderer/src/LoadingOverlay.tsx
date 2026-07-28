interface LoadingOverlayProps {
  message: string
}

function LoadingOverlay({ message }: LoadingOverlayProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-20 flex cursor-wait flex-col items-center justify-center gap-4 bg-black/65 text-text-primary">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-accent" />
      <div className="text-sm">{message}</div>
    </div>
  )
}

export default LoadingOverlay
