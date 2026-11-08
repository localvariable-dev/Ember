/**
 * Audio Timeline and Cue Generator
 * Master Plan Part 5 §6.3 & §6.4
 * Pure module: calculates exact millisecond clip placements and cue timelines from scripts.
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
