import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import type { Conflict, ScenePromptState } from '../lib/scenePromptState'

const help: Record<string, [string, string]> = {
  'empty-scene': ['Scene direction', 'Describe the action in Scene direction. The grey example is a placeholder; it is not part of your scene.'],
  'duration': ['Shot Builder', 'Set Clip duration to a number from 1 to 15 seconds.'],
  'missing-shots': ['Shot Builder', 'Add a shot, then set its start and end within the clip.'],
  'shot-timing': ['Shot Builder', 'Review each shot’s End (s). Shots must connect with no gaps or overlaps. Fit shots to clip redistributes their lengths evenly.'],
  'shot-end': ['Shot Builder', 'Set the last shot’s End (s) to Clip duration, or use Fit shots to clip.'],
  'camera-conflict': ['Shot Builder', 'Make the camera controls agree with your Scene wording. Change the control or edit the conflicting phrase.'],
  'wardrobe-conflict': ['Characters', 'Make the character’s wardrobe field agree with the outfit named in Scene. Neither explicit choice is silently replaced.'],
  'wardrobe-nudity-conflict': ['Scene', 'A preserved wardrobe and an explicit nude or undressed direction cannot both be true. Remove the nude wording from Scene to keep the outfit, or turn off Preserve on the wardrobe source if nudity is intentional.'],
  'attribute-sources': ['References', 'Expand Retained attributes & ownership. Keep this attribute selected on only one reference for this owner; leave identity selected on multiple views if needed.'],
  'owner-required': ['References', 'Expand this card’s Retained attributes & ownership and choose its Character owner. Add the character in Characters first if needed.'],
  'missing-owner': ['References', 'Choose an existing Character owner in this reference card.'],
  'role-required': ['References', 'Choose Reference only and select what this image contributes, or assign it as the single Frame 0 anchor when it must condition the opening at 0.00s.'],
  'multiple-anchors': ['Frame 0 guide', 'Choose exactly one Frame 0 anchor. Other pictures can remain reference-only, and at most one separate ending frame can be active.'],
  'missing-opening': ['References', 'Choose an image in Sources as the first frame. It will be the exact visual state at 0.00 seconds.'],
  'missing-ending': ['References', 'Choose an image in Sources as the last frame. An opening image is optional in Frame endpoints mode.'],
  'visual-required': ['References', 'Use Add Reference to attach at least one image or video.'],
  'reference-limit': ['References', 'Open Character library & media and remove excess references: up to 9 images, 3 videos and 3 audio inputs, including enabled video soundtracks.'],
  'duplicate-reference': ['References', 'Open Character library & media and remove the duplicate source.'],
  'anchor-kind': ['References', 'Only a still image can be an opening or ending frame. Extract a frame from the source video first.'],
  'anchor-review': ['References', 'Expand this card, set the observed Frame shotSize and Frame angle, then review the image against your direction. Check “I reviewed the frame” only after checking it visually.'],
  'anchor-conflict': ['Frame 0 guide', 'To keep the native Frame 0 anchor, change the requested shot framing. For a newly generated opening, turn the guide off and retain the picture as a reference only.'],
  'anchor-attribute': ['Frame 0 guide', 'Keep the Frame 0 anchor and change the conflicting character or environment instruction, or turn the anchor off and use reference-only guidance.'],
  'reference-lock': ['References', 'Expand this card and uncheck the conflicting Lock control, or change your scene to match the locked value.'],
  'continuation-anchor': ['Frame 0 guide', 'Frame-0 continuation is required, but no picture is assigned to native frame_idx 0. Choose the extracted final frame in Frame 0 guide settings. If you only want the same cast, wardrobe, or location in a new composition, use reference-only scene continuity instead.'],
  'speech-disabled': ['Dialogue', 'Enable dialogue, or remove all spoken lines from both Scene direction and Dialogue.'],
  'dialogue-time': ['Dialogue', 'Expand Timing & delivery for the line. Choose a shot and a start time inside that shot.'],
  'dialogue-fields': ['Dialogue', 'For every line, choose a speaker, enter a language such as English, and enter the spoken words.'],
  'dialogue-markup': ['Dialogue', 'Remove H3 tags and angle brackets from dialogue fields. Enter only the words and language; the compiler adds the syntax.'],
  'speaker-missing': ['Dialogue', 'Select a character that is still listed in Characters as this line’s speaker.'],
  'audio-speaker': ['References', 'Expand the voice reference and select its Speaker. Add a spoken line for that character in Dialogue, or choose Ambience if this source is not a voice.'],
  'speech-fit': ['Dialogue', 'Shorten the line or increase its shot duration. Use Across cuts for a continued line, or Cut off at clip end for an intentional interruption.'],
  'speech-continuation': ['Dialogue', 'Add the next or previous part in the adjacent shot with the same speaker and matching Across cuts choices. Otherwise choose Complete line.'],
  'full-audio-conflict': ['Sound & music', 'A complete copied soundtrack conflicts with additional dialogue or audio. Remove the extra audio direction, or change the source’s Audio relationship to reference or partially_copy.'],
  'legacy-format': ['Scene', 'Keep filmmaking language in Scene. To edit an existing H3 prompt directly, select Manual Override and paste it there.'],
  'empty-manual': ['Manual Override', 'Enter your H3 prompt in Manual Override, or return to Scene Composer to use automatic compilation.'],
  'manual-reference': ['Manual Override', 'Compare the reference mapping in H3 Debug with the labels in your manual prompt. Attach the missing media or update the label.'],
  'manual-timing': ['Manual Override', 'Move this cut before the selected clip end, or increase Clip duration.'],
  'command-target': ['Scene', 'Name the image in the command, for example: //preserve Picture 3 wardrobe, environment, lighting'],
}

export function SceneIssues({ conflicts, state, onChange, onReferences }: { conflicts: Conflict[]; state: ScenePromptState; onChange(state: ScenePromptState): void; onReferences(): void }) {
  const errors = conflicts.filter(item => item.severity === 'error').length
  const jump = (section: string, referenceId?: string) => {
    if (section === 'Manual Override') { onChange({ ...state, view: 'manual' }); return }
    const root = document.querySelector('.scene-composer')
    const card = referenceId ? Array.from(root?.querySelectorAll<HTMLElement>('[data-reference-id]') || []).find(el => el.dataset.referenceId === referenceId) : undefined
    const target = card || Array.from(root?.querySelectorAll<HTMLElement>('.scene-section, .scene-authoring') || []).find(el => el.textContent?.includes(section))
    if (card) card.querySelector('details')?.setAttribute('open', '')
    if (target instanceof HTMLDetailsElement) target.open = true
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target?.querySelector<HTMLElement>('input, textarea, select, button')?.focus({ preventScroll: true })
  }
  return <section className={`scene-issues ${errors ? 'has-errors' : ''}`} aria-label="Scene readiness">
    <header>{errors ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}<div><strong>{errors ? `${errors} ${errors === 1 ? 'change' : 'changes'} needed before rendering` : 'Scene checks passed'}</strong><p>{errors ? 'Each item below explains the problem and where to fix it.' : conflicts.length ? 'Review the suggestions below. They do not block rendering.' : 'Your scene, references and timing are consistent.'}</p></div></header>
    {conflicts.map((conflict, index) => {
      const [section, guidance] = help[conflict.code] || ['References', 'Review this source’s assignment in References and the mapping in H3 Debug.']
      return <article key={`${conflict.code}-${conflict.referenceId}-${index}`}><div className="scene-issue-title"><span>{conflict.severity === 'error' ? 'Required' : 'Suggestion'}</span><strong>{conflict.message}</strong></div><p>{guidance}</p><div className="scene-issue-actions">
        {conflict.code === 'continuation-anchor' && <button type="button" onClick={() => onChange({ ...state, continuity: { ...state.continuity, exactFrame: false, scene: true } })}>Use scene continuity instead</button>}
        {conflict.code === 'speech-disabled' && <button type="button" onClick={() => onChange({ ...state, noDialogue: false })}>Enable dialogue</button>}
        {['shot-timing', 'shot-end', 'missing-shots'].includes(conflict.code) && Number.isFinite(state.duration) && state.duration > 0 && <button type="button" onClick={() => { const shots = state.shots.length ? state.shots : [{ id: 'shot-1', start: 0, end: state.duration, description: '', camera: {}, characterIds: [] }]; onChange({ ...state, shots: shots.map((shot, i) => ({ ...shot, start: state.duration * i / shots.length, end: state.duration * (i + 1) / shots.length })) }) }}>Fit shots to clip</button>}
        {['missing-opening', 'missing-ending', 'visual-required', 'reference-limit', 'duplicate-reference'].includes(conflict.code) ? <button type="button" onClick={onReferences}>{state.mode === 'image' || state.mode === 'frames' ? 'Choose source frames' : 'Open reference library'} <ArrowRight size={12} /></button> : <button type="button" onClick={() => jump(section, conflict.referenceId)}>Review {section} <ArrowRight size={12} /></button>}
      </div></article>
    })}
  </section>
}
