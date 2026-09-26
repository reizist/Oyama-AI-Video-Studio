import { Activity, CircleStop, ExternalLink, Film, History, Image as ImageIcon, LoaderCircle, Music2 } from 'lucide-react'
import type { GenerationJob } from '../types'
import { modelLabel, modelPrecisionLabel, shortPrompt } from '../lib/jobPresentation'
import { MovieMediaThumbnail } from './MovieMediaThumbnail'
import { DeleteGenerationButton } from './DeleteGenerationButton'

export function StatusBadge({ status }: { status: GenerationJob['status'] }) {
  return <span className={`status-badge ${status}`}>{status === 'running' && <LoaderCircle size={12} className="spin" />}{status}</span>
}

export function JobExecutionChips({ job, expanded = false }: { job: GenerationJob; expanded?: boolean }) {
  const execution = job.execution
  if (!execution) return null
  const chips = [
    execution.attentionBackend && { label: execution.attentionBackend, emphasis: /int8 attention|sage/i.test(execution.attentionBackend) },
    execution.diffusionPrecision && { label: execution.diffusionPrecision },
    execution.gpuRouting && { label: execution.gpuRouting, emphasis: /GPU 1|5060/i.test(execution.gpuRouting) },
    execution.sampler && { label: `${execution.sampler} + ${execution.scheduler ?? 'scheduler'}` },
    execution.preview && { label: `Preview: ${execution.preview}` },
    execution.upscale && execution.upscale !== 'Off' && { label: execution.upscale },
    execution.referenceCount !== undefined && { label: `${execution.referenceCount} reference${execution.referenceCount === 1 ? '' : 's'}` },
    ...(execution.adapters?.map((adapter) => ({ label: adapter })) ?? []),
    ...(expanded ? [
      execution.diffusionModel && { label: `Model: ${modelLabel(execution.diffusionModel)}`, detail: execution.diffusionModel },
      execution.textEncoder && { label: `Encoder: ${modelPrecisionLabel(execution.textEncoder) ?? modelLabel(execution.textEncoder)}`, detail: execution.textEncoder },
    ] : []),
  ].filter((chip): chip is { label: string; emphasis?: boolean; detail?: string } => Boolean(chip))
  return chips.length ? <div className={`job-execution-chips ${expanded ? 'expanded' : ''}`} aria-label="Render configuration">{chips.map((chip) => <span key={`${chip.label}-${chip.detail ?? ''}`} className={chip.emphasis ? 'accelerated' : ''} title={chip.detail ?? chip.label}>{chip.label}</span>)}</div> : null
}

export function ComfyActivityConsole({ job }: { job: GenerationJob }) {
  const activity = job.comfyActivity ?? []
  const running = job.status === 'queued' || job.status === 'running'
  const fallback = running
    ? [{ at: job.createdAt, level: 'info' as const, message: job.promptId ? `ComfyUI accepted prompt ${job.promptId}; waiting for execution updates.` : 'Preparing locally. This workflow has not been submitted to ComfyUI yet.' }]
    : []
  const entries = activity.length ? activity : fallback
  if (!entries.length) return null
  const latest = entries.at(-1)!
  return <details className={`comfy-activity-console ${job.status === 'failed' ? 'has-error' : ''}`} open={job.status === 'failed'}>
    <summary>
      <span><Activity size={14} />ComfyUI activity</span>
      <small title={latest.message}>{latest.message}</small>
      <span className={`activity-state ${latest.level}`}>{running ? 'live' : job.status}</span>
    </summary>
    <div className="comfy-activity-log" role="log" aria-label="ComfyUI activity log" aria-live="polite">
      {entries.map((entry, index) => <div className={`comfy-activity-entry ${entry.level}`} key={`${entry.at}-${index}`}><time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time><span>{entry.message}</span></div>)}
    </div>
  </details>
}

export function JobsView({ title, note, jobs, empty, cancellingIds, onCancel, onDelete }: { title: string; note: string; jobs: GenerationJob[]; empty: string; cancellingIds: Set<string>; onCancel(job: GenerationJob): Promise<void>; onDelete(job: GenerationJob, mode: 'history' | 'trash' | 'permanent'): Promise<void> }) {
  return <div className="standard-page">
    <div className="page-heading"><div><p className="eyebrow">LOCAL WORKSPACE</p><h1>{title}</h1><p>{note}</p></div></div>
    {jobs.length === 0 ? <div className="empty-page"><History size={28} /><strong>{empty}</strong><span>New work is saved automatically on this device.</span></div> : <div className="job-list">{jobs.map((job) => {
      const audio = job.mediaType === 'audio'
      const image = job.mediaType === 'image'
      const active = job.status === 'running' || job.status === 'queued'
      return <article className={`job-row ${active ? 'constructing' : ''}`} key={job.id}>
        <div className={`job-thumbnail ${audio ? 'audio' : ''}`}>{job.outputUrl ? audio ? <Music2 /> : image ? <img src={job.outputUrl} alt="Generated reference still" /> : <span aria-label="Video output"><MovieMediaThumbnail source={job.outputUrl} posterUrl={job.thumbnailUrl} /></span> : job.status === 'running' ? <LoaderCircle className="spin" /> : audio ? <Music2 /> : image ? <ImageIcon /> : <Film />}</div>
        <div className="job-copy"><div><StatusBadge status={job.status} /><span>{new Date(job.createdAt).toLocaleString()}</span></div><strong>{shortPrompt(job.prompt)}</strong><small>{audio ? `${job.provider === 'music3' ? 'Music 3' : 'ACE-Step'} · ${job.duration}s · audio` : `${job.width} × ${job.height} · ${image ? 'Ref2VA still' : `${job.duration}s · ${job.mode}`}`}</small><JobExecutionChips job={job} />{job.outputUrl && audio && <audio className="job-audio" src={job.outputUrl} controls preload="metadata" />}{active && <><small className="job-progress-label">{job.progressLabel ?? (job.status === 'queued' ? 'Waiting in queue' : audio ? 'Generating music locally' : image ? 'Generating one reference still' : 'Rendering locally')}{job.queuePosition ? ` · position ${job.queuePosition}` : ''}{job.currentStep !== undefined && job.totalSteps ? ` · ${job.currentStep}/${job.totalSteps}` : ''}</small><div className="progress compact"><i style={{ width: `${job.progress}%` }} /></div></>}{job.error && <p className="job-error">{job.error}</p>}<ComfyActivityConsole job={job} /></div>
        <div className="job-actions">{job.outputUrl && <a className="secondary-button" href={job.outputUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open</a>}{active && <button className="danger-button" disabled={cancellingIds.has(job.id)} onClick={() => void onCancel(job)}>{cancellingIds.has(job.id) ? <LoaderCircle size={15} className="spin" /> : <CircleStop size={15} />}{cancellingIds.has(job.id) ? 'Stopping…' : 'Stop'}</button>}<DeleteGenerationButton job={job} onDelete={onDelete} /></div>
      </article>
    })}</div>}
  </div>
}
