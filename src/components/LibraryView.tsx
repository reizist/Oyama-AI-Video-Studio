import { useEffect, useState } from 'react'
import { Bookmark, ExternalLink, Film, Gauge, History, ImagePlus, LoaderCircle, Play, Scissors, Sparkles, Watch, X } from 'lucide-react'
import type { AppSettings, GenerationJob, MediaFile } from '../types'
import { libraryPromptTitle, shortPrompt } from '../lib/jobPresentation'
import { FrameBookmarkStudio, type BookmarkVideo } from './FrameBookmarkStudio'
import { MovieMediaThumbnail } from './MovieMediaThumbnail'
import { VideoPlayer } from './VideoPlayer'
import { DeleteGenerationButton } from './DeleteGenerationButton'

export function LibraryView({ jobs, settings, onDelete, onEdit, onCreate, onUseLtx, onUseLastFrameReference, onNotice }: { jobs: GenerationJob[]; settings: AppSettings; onDelete(job: GenerationJob, mode: 'history' | 'trash' | 'permanent'): Promise<void>; onEdit(): void; onCreate(): void; onUseLtx(file: MediaFile): void; onUseLastFrameReference(job: GenerationJob, opening: { mode: 'match' | 'reframe' | 'arc'; cameraAngle?: string }): Promise<void>; onNotice(tone: 'error' | 'success' | 'neutral', text: string): void }) {
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState<'all' | 'minimax' | 'ltx25'>('all')
  const [mediaType, setMediaType] = useState<'all' | 'video' | 'image'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [bookmarkVideo, setBookmarkVideo] = useState<BookmarkVideo | null>(null)
  const [lightbox, setLightbox] = useState<GenerationJob | null>(null)
  const [rife, setRife] = useState<{ installed: boolean; executable?: string; error?: string } | null>(null)
  const [rifeBusyId, setRifeBusyId] = useState<string | null>(null)
  const [referenceBusyId, setReferenceBusyId] = useState<string | null>(null)
  const [openingMode, setOpeningMode] = useState<'match' | 'reframe' | 'arc'>('match')
  const [openingCameraAngle, setOpeningCameraAngle] = useState('side camera angle')
  const available = jobs.filter((job) => job.mediaType !== 'audio' && Boolean(job.outputUrl))
  const filtered = available.filter((job) => (provider === 'all' || (job.provider ?? 'minimax') === provider) && (mediaType === 'all' || (mediaType === 'image' ? job.mediaType === 'image' : job.mediaType !== 'image')) && (!query.trim() || job.prompt.toLowerCase().includes(query.trim().toLowerCase()))).sort((a, b) => sort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt)
  const videos: BookmarkVideo[] = available.filter(job => job.mediaType !== 'image').map((job) => ({ id: `job-${job.id}`, name: shortPrompt(job.prompt), source: job.outputUrl!, duration: job.duration, provider: job.provider === 'ltxripple' ? 'ltxripple' : job.provider === 'ltx25' ? 'ltx25' : 'minimax' }))
  useEffect(() => {
    if (!lightbox) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [lightbox])
  useEffect(() => { void window.minimax.getRifeStatus().then(setRife).catch(() => setRife({ installed: false })) }, [])
  const runRife = async (job: GenerationJob, mode: 'fps-2x' | 'slow-motion') => {
    setRifeBusyId(job.id)
    try {
      let status = rife
      if (!status?.installed) { status = await window.minimax.installRife(); setRife(status) }
      if (!status?.installed) throw new Error(status?.error || 'RIFE setup did not finish.')
      const result = await window.minimax.interpolateVideo(job.outputUrl!, settings.outputDirectory, settings.ffmpegPath, mode)
      await window.minimax.showOutput(result.path)
      onNotice('success', mode === 'slow-motion' ? 'Cinematic slow-motion render created with RIFE and opened in its output folder.' : '48 fps RIFE optical-flow render created and opened in its output folder.')
    } catch (error) { onNotice('error', error instanceof Error ? error.message : String(error)) } finally { setRifeBusyId(null) }
  }
  const addLastFrameReference = async (job: GenerationJob) => {
    setReferenceBusyId(job.id)
    try { await onUseLastFrameReference(job, openingMode === 'match' ? { mode: 'match' } : { mode: openingMode, cameraAngle: openingCameraAngle }) }
    catch (error) { onNotice('error', `Could not create the final-frame reference: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setReferenceBusyId(null) }
  }
  return <div className="standard-page library-page"><div className="page-heading"><div><p className="eyebrow">LOCAL LIBRARY</p><h1>Video library</h1><p>Review renders, collect reusable frames, or assemble clips without changing the originals.</p></div><button className="primary-button" onClick={onEdit}><Scissors size={16} />Open movie editor</button></div>
    <div className="library-toolbar"><label><span>Search renders</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search prompts…" /></label><label><span>Provider</span><select value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}><option value="all">All providers</option><option value="minimax">MiniMax H3</option><option value="ltx25">LTX 2.5</option></select></label><label><span>Media</span><select value={mediaType} onChange={(event) => setMediaType(event.target.value as typeof mediaType)}><option value="all">Images and videos</option><option value="video">Videos</option><option value="image">Images</option></select></label><label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label><div><strong>{filtered.length}</strong><span>of {available.length} assets</span></div></div>
    {available.length === 0 ? <div className="empty-page library-first-run"><History size={28} /><strong>Your finished renders will live here</strong><span>Generate a shot to start the library. Finished videos are saved automatically on this device.</span><div className="library-first-run-actions"><button className="primary-button" onClick={onCreate}><Film size={15} />Open Video workspace</button><button className="secondary-button" onClick={onEdit}><Scissors size={15} />Open movie editor</button></div></div> : filtered.length === 0 ? <div className="empty-page compact"><Film size={25} /><strong>No results match these filters.</strong><button className="secondary-button" onClick={() => { setQuery(''); setProvider('all'); setMediaType('all') }}>Clear filters</button></div> : <div className="library-grid">{filtered.map((job) => {
      const image = job.mediaType === 'image'
      const video = videos.find(item => item.id === `job-${job.id}`)
      const rifeBusy = rifeBusyId === job.id
      const title = libraryPromptTitle(job.prompt)
      return <article className="library-card" key={job.id}>
        <button type="button" className="library-card-media" onClick={() => setLightbox(job)} aria-label={`Preview ${title}`}>
          {image ? <img src={job.outputUrl} alt="" /> : <MovieMediaThumbnail source={job.outputUrl!} posterUrl={job.thumbnailUrl} />}
          <span className="library-media-play"><Play size={16} fill="currentColor" /></span>
          {!image && <span className="library-media-duration">{job.duration}s</span>}
        </button>
        <div className="library-card-body">
          <div className="library-card-meta"><span className={`library-provider ${job.provider === 'ltx25' || job.provider === 'ltxripple' ? 'ltx' : ''}`}>{image ? 'Ref2VA still' : job.provider === 'ltxripple' ? 'LTX Ripple' : job.provider === 'ltx25' ? 'LTX 2.5' : 'MiniMax H3'}</span><time dateTime={new Date(job.createdAt).toISOString()}>{new Date(job.createdAt).toLocaleDateString()}</time></div>
          <strong title={job.prompt}>{title}</strong>
          <small>{job.width} × {job.height} · {image ? 'one image' : `${job.duration}s · ${job.mode}`}</small>
          <div className="library-card-actions">
            <button className="secondary-button" onClick={() => setLightbox(job)}><Watch size={15} />Preview</button>
            {!image && video && <button className="primary-button" onClick={() => setBookmarkVideo(video)}><Bookmark size={15} />Frame bookmarks</button>}
            <a className="secondary-button" href={job.outputUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open file</a>
            <DeleteGenerationButton job={job} onDelete={onDelete} />
          </div>
          {!image && <details className="library-rife"><summary><Gauge size={14} />RIFE motion tools</summary><span>{rife?.installed ? 'Optical-flow derivative · original remains unchanged.' : 'Installs the official local RIFE tool on first use.'}</span><div><button className="secondary-button" disabled={Boolean(rifeBusyId)} onClick={() => void runRife(job, 'fps-2x')}>{rifeBusy ? <LoaderCircle className="spin" size={14} /> : <Gauge size={14} />}48 fps</button><button className="secondary-button" disabled={Boolean(rifeBusyId)} onClick={() => void runRife(job, 'slow-motion')}>{rifeBusy ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}Cinematic slow motion</button></div></details>}
        </div>
      </article>
    })}</div>}
    {lightbox && <div className="media-lightbox-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(null) }}><section className="media-lightbox" role="dialog" aria-modal="true" aria-labelledby="library-preview-title"><header><span><small>LIBRARY PREVIEW</small><strong id="library-preview-title">{shortPrompt(lightbox.prompt)}</strong></span><button className="icon-button" onClick={() => setLightbox(null)} aria-label="Close preview"><X size={18} /></button></header><div className="media-lightbox-stage">{lightbox.mediaType === 'image' ? <img src={lightbox.outputUrl} alt="Generated reference still" /> : <VideoPlayer src={lightbox.outputUrl!} />}</div><footer><span>{lightbox.width} × {lightbox.height} · {lightbox.mediaType === 'image' ? 'Still image' : `${lightbox.duration}s video`}</span><div className="media-lightbox-actions">{lightbox.mediaType !== 'image' && <div className="opening-frame-builder"><div><strong>Next-shot frame conditioning</strong><small>Extract the absolute final frame, then choose native Frame 0 conditioning or reference-only guidance.</small></div><fieldset disabled={referenceBusyId === lightbox.id}><legend>Conditioning treatment</legend><label><input type="radio" name="opening-treatment" checked={openingMode === 'match'} onChange={() => setOpeningMode('match')} /><span><strong>Frame 0 anchor</strong><small>Native Add Guide conditioning at frame_idx 0; fixes the opening visual state.</small></span></label><label><input type="radio" name="opening-treatment" checked={openingMode === 'reframe'} onChange={() => setOpeningMode('reframe')} /><span><strong>Reference only · reframe</strong><small>Guides scene identity while H3 generates a new opening angle; frame 0 is not locked.</small></span></label><label><input type="radio" name="opening-treatment" checked={openingMode === 'arc'} onChange={() => setOpeningMode('arc')} /><span><strong>Frame 0 anchor, then arc</strong><small>Native frame_idx 0 guide first, followed by the requested camera movement.</small></span></label></fieldset>{openingMode !== 'match' && <label className="opening-camera-angle"><span>{openingMode === 'arc' ? 'Target camera angle' : 'Opening camera angle'}</span><select value={openingCameraAngle} onChange={(event) => setOpeningCameraAngle(event.target.value)}><option value="side camera angle">Side camera angle</option><option value="three-quarter camera angle">Three-quarter camera angle</option><option value="front-facing camera angle">Front-facing camera angle</option><option value="low camera angle">Low camera angle</option><option value="high camera angle">High camera angle</option><option value="over-the-shoulder camera angle">Over-the-shoulder camera angle</option></select></label>}<button className="primary-button" disabled={referenceBusyId === lightbox.id} onClick={() => void addLastFrameReference(lightbox)} title="Extract the final frame and use it as a native Frame 0 anchor or a reference-only reframe source">{referenceBusyId === lightbox.id ? <LoaderCircle className="spin" size={15} /> : <ImagePlus size={15} />}{referenceBusyId === lightbox.id ? 'Extracting final frame…' : openingMode === 'match' ? 'Use native Frame 0 anchor' : openingMode === 'reframe' ? 'Use reference-only reframe' : 'Use Frame 0 anchor + arc'}<small>Experimental</small></button></div>}<button className="secondary-button" onClick={() => setLightbox(null)}>Close</button></div></footer></section></div>}
    {bookmarkVideo && <FrameBookmarkStudio key={bookmarkVideo.id} initialVideo={bookmarkVideo} videos={videos} settings={settings} onClose={() => setBookmarkVideo(null)} onUseLtx={onUseLtx} onNotice={onNotice} />}
  </div>
}
