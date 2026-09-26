import type { FrameResolution, FrameSize } from '../lib/frameResolution'
import { resolveFrameSize, sourceAspectChanges } from '../lib/frameResolution'
import './frame-resolution.css'

export function FrameResolutionControl({ source, value, onChange, disabled = false }: {
  source: FrameSize | null
  value: FrameResolution
  onChange(value: FrameResolution): void
  disabled?: boolean
}) {
  const output = resolveFrameSize(source, value)
  return <fieldset className="frame-resolution" disabled={disabled}>
    <legend>Frame resolution</legend>
    <label>Output size<select value={value.mode} onChange={event => onChange({ ...value, mode: event.target.value as FrameResolution['mode'] })}>
      <option value="balanced">Balanced · 768 px longest side</option>
      <option value="detailed">Detailed · 1024 px longest side</option>
      <option value="source">Match source · nearest valid size</option>
      <option value="custom">Custom width and height</option>
    </select></label>
    {value.mode === 'custom' && <div className="frame-resolution-custom"><label>Width<input type="number" min="256" max="2048" step="32" value={value.width} onChange={event => onChange({ ...value, width: Number(event.target.value) })}/></label><label>Height<input type="number" min="256" max="2048" step="32" value={value.height} onChange={event => onChange({ ...value, height: Number(event.target.value) })}/></label></div>}
    <p className="frame-resolution-summary" role="status">{source ? `Source ${source.width} × ${source.height}` : 'Choose a source to calculate size'}{output ? ` → output ${output.width} × ${output.height}` : ' · output size unavailable'}</p>
    {value.mode === 'source' && source && output && (source.width !== output.width || source.height !== output.height) && <small>Aligned to the nearest multiple of 32 for LTX. The source frame is scaled and center cropped by a few pixels.</small>}
    {source && output && sourceAspectChanges(source, output) && <small className="frame-resolution-warning">Output aspect ratio differs from the source. The frame will be center cropped.</small>}
    {value.mode === 'custom' && !output && <small className="frame-resolution-warning">Use 256–2048 pixels for each side, in multiples of 32.</small>}
    {output && Math.max(output.width, output.height) > 1024 && <small className="frame-resolution-warning">High resolutions need substantially more GPU memory and may fail on smaller cards.</small>}
  </fieldset>
}
