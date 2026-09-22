export function buildCharacterIdentitySurveyPrompt(characterName: string, referenceCount: number) {
  const name = characterName.trim() || 'the character'
  const count = Math.max(1, Math.min(9, Math.floor(referenceCount)))
  const referenceAssignments = Array.from({ length: count }, (_, index) => index === 0
    ? `<Picture 1> is the primary master identity reference for ${name}.`
    : `<Picture ${index + 1}> is an additional approved identity view of the same person.`).join(' ')

  return `Ten-second MiniMax H3 Ref2VA full-body character identity coverage survey of ${name} in one continuous stabilized take. Reference assignment: ${referenceAssignments} Treat every supplied picture as authoritative visual evidence of one and the same person. Resolve any minor disagreement in favor of <Picture 1>. Preserve the exact facial geometry, skin tone and texture, apparent age, eyes, nose, mouth, jawline, ears, hairline, hairstyle, distinguishing marks, body proportions, hands, feet, clothing, and neutral studio treatment shown by the references. Do not reproduce the reference pictures as panels, a collage, or pictures inside the scene.

From 0.0 to 2.0 seconds, hold a sharp neutral full-body front view with the complete head, both hands, and both feet visible. Keep the person centered at a useful identity-reference scale.

From 2.0 to 5.0 seconds, make a slow stabilized camera push to a sharp head-and-shoulders close-up. The person remains still and front-facing with a neutral expression.

From 5.0 to 7.0 seconds, hold the face clearly while the camera moves gently between frontal and three-quarter facial angles so the eyes, nose, mouth, jawline, ears, hairline, and distinguishing marks remain readable and temporally stable.

From 7.0 to 10.0 seconds, pull back smoothly until the complete body is visible again, then continue a restrained camera orbit through three-quarter, exact side-profile, and rear body angles. Keep the complete head, hands, and feet inside the frame throughout the final coverage.

The character remains physically still with a neutral expression and unchanged stance while only the camera moves. Use even soft studio lighting, a plain unchanged neutral studio background, accurate anatomy, crisp individual frames, and a fast shutter. One continuous shot. No cuts, identity drift, face swap, morphing, pose changes, expression changes, body-proportion changes, hairstyle changes, clothing changes, added objects, duplicate people, extra limbs or fingers, cropped head or feet, motion blur, temporal smearing, ghosting, flicker, rolling-shutter distortion, whip pans, text, logos, subtitles, dialogue, narration, singing, or lip-sync. Use quiet room tone only.`
}
