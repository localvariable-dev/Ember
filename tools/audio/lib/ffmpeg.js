/**
 * FFmpeg Command and Filter Graph Builders
 * Master Plan Part 5 §6.5
 * Pure functions returning structured command arguments for testability and execution.
 */

export function buildTrimClipCommand(inputWav, outputWav) {
  const filter = [
    'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB',
    'areverse',
    'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB',
    'areverse',
    'afade=t=in:d=0.01',
    'areverse',
    'afade=t=in:d=0.02',
    'areverse',
  ].join(',');

  return ['-y', '-i', inputWav, '-ar', '48000', '-ac', '1', '-af', filter, outputWav];
}

export function buildRoomToneCommand(outputWav, durationSeconds) {
  const d = Math.ceil(durationSeconds);
  return [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `anoisesrc=d=${d}:c=pink:r=48000:a=0.0015`,
    '-af',
    'highpass=f=80,lowpass=f=3500',
    '-ac',
    '1',
    outputWav,
  ];
}

export function buildMixCommand(roomWav, clips, outputWav, durationSeconds) {
  const args = ['-y', '-i', roomWav];

  for (const c of clips) {
    args.push('-i', c.path);
  }

  const delayFilters = [];
  const mixInputs = ['[0]'];

  clips.forEach((c, i) => {
    const inputIdx = i + 1;
    const label = `a${inputIdx}`;
    delayFilters.push(`[${inputIdx}]adelay=${Math.round(c.startMs)}[${label}]`);
    mixInputs.push(`[${label}]`);
  });

  const numInputs = clips.length + 1;
  const amix = `${mixInputs.join('')}amix=inputs=${numInputs}:normalize=0:duration=first[m]`;

  const filterComplex = [...delayFilters, amix].join(';');

  args.push(
    '-filter_complex',
    filterComplex,
    '-map',
    '[m]',
    '-ar',
    '48000',
    '-ac',
    '1',
    '-t',
    String(durationSeconds),
    outputWav,
  );

  return args;
}

export function buildLoudnormMeasureCommand(inputWav) {
  return [
    '-i',
    inputWav,
    '-af',
    'loudnorm=I=-18:TP=-1.5:LRA=7:print_format=json',
    '-f',
    'null',
    '-',
  ];
}

export function buildLoudnormApplyAndEncodeCommand(
  inputWav,
  measured,
  outputOgg,
  durationSeconds,
  bitrate = '32k',
) {
  const loudnorm = [
    'loudnorm=I=-18:TP=-1.5:LRA=7',
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset ?? '-0.1'}`,
    'linear=true',
    `apad=whole_dur=${durationSeconds}`,
  ].join(':');

  return [
    '-y',
    '-i',
    inputWav,
    '-af',
    loudnorm,
    '-t',
    String(durationSeconds),
    '-ar',
    '48000',
    '-ac',
    '1',
    '-c:a',
    'libopus',
    '-b:a',
    bitrate,
    '-vbr',
    'on',
    '-application',
    'audio',
    outputOgg,
  ];
}

export function buildNoiseCrossfadeCommand(inputWav, outputOgg, loopSeconds = 60) {
  return [
    '-y',
    '-i',
    inputWav,
    '-t',
    String(loopSeconds),
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'libopus',
    '-b:a',
    '96k',
    '-vbr',
    'on',
    outputOgg,
  ];
}

export function buildFlacEncodeCommand(inputWav, outputFlac) {
  return ['-y', '-i', inputWav, '-ar', '22050', '-ac', '2', '-c:a', 'flac', outputFlac];
}
