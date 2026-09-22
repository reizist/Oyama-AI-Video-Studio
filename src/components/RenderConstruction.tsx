import { ProductionLoading } from './Workspace'
export function RenderConstruction({ state = 'running', label, progress }: { state?: string; label?: string; progress?: number }) {
 return <ProductionLoading label={label || (state === 'queued' ? 'Queued · preparing references' : 'Processing · awaiting engine stage')} progress={progress} />
}
