import { useRef, type PointerEvent } from 'react'

export function MoviePanelDivider({ label, value, min, max, onChange, vertical = false, reverse = false, className = '' }: {
  label: string; value: number; min: number; max: number; onChange(value: number): void; vertical?: boolean; reverse?: boolean; className?: string
}) {
  const start = useRef<{ coordinate: number; value: number } | null>(null)
  const change = (next: number) => onChange(Math.min(max, Math.max(min, next)))
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return
    change(start.current.value + ((vertical ? event.clientY : event.clientX) - start.current.coordinate) * (reverse ? -1 : 1))
  }
  return <div className={`movie-panel-divider ${vertical ? 'horizontal' : ''} ${className}`} role="separator" tabIndex={0} aria-label={label} aria-orientation={vertical ? 'horizontal' : 'vertical'} aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)}
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); start.current = { coordinate: vertical ? event.clientY : event.clientX, value }; event.currentTarget.setPointerCapture(event.pointerId) }}
    onPointerMove={move} onPointerUp={event => { move(event); start.current = null; event.currentTarget.releasePointerCapture(event.pointerId) }} onPointerCancel={() => { start.current = null }} onLostPointerCapture={() => { start.current = null }}
    onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); change(value + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -10 : 10) * (reverse ? -1 : 1)) } }} />
}
