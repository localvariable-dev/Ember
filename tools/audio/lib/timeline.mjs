/**
 * Audio Timeline and Cue Generator
 * Master Plan Part 5 §6.3 & §6.4
 * Pure module: calculates exact millisecond clip placements and cue timelines from scripts.
 */

/**
 * @typedef {Object} Segment
 * @property {string} text
 * @property {number} [atMs] Offset relative to block start (anchored)
 * @property {number} [pauseAfterMs] Room-tone pause following this segment (flow)
 *
 * @typedef {Object} Cue
 * @property {'breath' | 'sigh' | 'body' | 'release' | 'silence' | 'outro'} type
 * @property {string} [label]
 * @property {number} startMs
 * @property {number} endMs
 * @property {object} [pattern]
 *
 * @typedef {Object} Block
 * @property {string} id
 * @property {{ type: string, label?: string, pattern?: object }} cue
 * @property {number} [durationMs] Anchored duration if present
 * @property {Segment[]} segments
 *
 * @typedef {Object} Script
 * @property {string} id
 * @property {number} targetMs
 * @property {Block[]} blocks
 * @property {{ focus: Block[], sleep: Block[], durationMs: number }} [outro]
 */

/**
 * Calculates timeline layout and cues for a script and variant.
 *
 * @param {Script} script
 * @param {Map<string, number> | ((text: string) => number)} clipDurations Measured clip lengths in ms
 * @param {'focus' | 'sleep' | 'none'} [variant='none']
 * @returns {{
 *   totalMs: number,
 *   cues: Cue[],
 *   clips: Array<{ blockId: string, text: string, startMs: number, durationMs: number, endMs: number }>
 * }}
 */
export function buildTimeline(script, clipDurations, variant = 'none') {
  const getDuration = (text) => {
    if (typeof clipDurations === 'function') {
      return clipDurations(text);
    }
    return clipDurations.get(text) ?? 2000;
  };

  const blocks = [...script.blocks];

  if (variant !== 'none' && script.outro) {
    const outroBlocks = script.outro[variant];
    if (outroBlocks && Array.isArray(outroBlocks)) {
      blocks.push(...outroBlocks);
    }
  }

  const cues = [];
  const clips = [];
  let currentBlockStartMs = 0;

  for (const block of blocks) {
    const isAnchored = typeof block.durationMs === 'number' && block.durationMs > 0;
    let blockCursorMs = currentBlockStartMs;
    let maxClipEndMs = currentBlockStartMs;

    for (const seg of block.segments) {
      const clipLengthMs = getDuration(seg.text);
      let clipStartMs;

      if (isAnchored && typeof seg.atMs === 'number') {
        clipStartMs = currentBlockStartMs + seg.atMs;
      } else {
        clipStartMs = blockCursorMs;
      }

      const clipEndMs = clipStartMs + clipLengthMs;

      clips.push({
        blockId: block.id,
        text: seg.text,
        startMs: clipStartMs,
        durationMs: clipLengthMs,
        endMs: clipEndMs,
      });

      maxClipEndMs = Math.max(maxClipEndMs, clipEndMs);

      const pauseAfter = seg.pauseAfterMs ?? 0;
      blockCursorMs = clipEndMs + pauseAfter;
    }

    const blockDurationMs = isAnchored
      ? block.durationMs
      : Math.max(blockCursorMs - currentBlockStartMs, 1000);

    const blockEndMs = currentBlockStartMs + blockDurationMs;

    // Validation: clip must not overrun block duration if anchored
    if (isAnchored && maxClipEndMs > blockEndMs + 200) {
      throw new Error(
        `Block '${block.id}' overrun: clips end at +${maxClipEndMs - currentBlockStartMs}ms but duration is anchored at ${blockDurationMs}ms`,
      );
    }

    const cueObj = {
      type: block.cue.type,
      startMs: currentBlockStartMs,
      endMs: blockEndMs,
      label: block.cue.label,
      pattern: block.cue.pattern,
    };
    if (cueObj.label === undefined) {
      delete cueObj.label;
    }
    if (cueObj.pattern === undefined) {
      delete cueObj.pattern;
    }

    cues.push(cueObj);
    currentBlockStartMs = blockEndMs;
  }

  // Verify total target duration bounds
  if (script.targetMs && currentBlockStartMs > script.targetMs + 1000) {
    throw new Error(
      `Timeline total duration (${currentBlockStartMs}ms) exceeds script targetMs (${script.targetMs}ms)`,
    );
  }

  return {
    totalMs: script.targetMs ?? currentBlockStartMs,
    cues,
    clips,
  };
}
