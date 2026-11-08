/**
 * Audio Pipeline Tools Unit Tests
 * Master Plan Part 5 §6.3, §6.4, §6.5
 */

import { buildTimeline } from '../../tools/audio/lib/timeline.js';
import {
  buildTrimClipCommand,
  buildRoomToneCommand,
  buildMixCommand,
  buildLoudnormMeasureCommand,
  buildLoudnormApplyAndEncodeCommand,
  buildNoiseCrossfadeCommand,
  buildFlacEncodeCommand,
} from '../../tools/audio/lib/ffmpeg.js';
import { VoiceStudioAdapter } from '../../tools/audio/tts/VoiceStudioAdapter.js';

describe('Audio Pipeline Tools & Builders', () => {
  describe('Timeline Builder', () => {
    const mockScript = {
      id: 'rapid_reset_5',
      targetMs: 300_000,
      blocks: [
        {
          id: 'settle',
          cue: { type: 'body', label: 'Settle in' },
          durationMs: 24_000,
          segments: [
            { text: 'Welcome.', atMs: 1000 },
            { text: 'Let your eyes close.', atMs: 9000 },
          ],
        },
        {
          id: 'flow_block',
          cue: { type: 'body', label: 'Flow' },
          segments: [
            { text: 'First phrase.', pauseAfterMs: 3000 },
            { text: 'Second phrase.', pauseAfterMs: 2000 },
          ],
        },
      ],
      outro: {
        durationMs: 90_000,
        focus: [
          {
            id: 'outro_focus',
            cue: { type: 'outro', label: 'Awaken' },
            durationMs: 90_000,
            segments: [{ text: 'Deepen breath.', atMs: 0 }],
          },
        ],
        sleep: [],
      },
    };

    it('places anchored segments at exact atMs offsets', () => {
      const result = buildTimeline(mockScript as any, () => 2000, 'none');

      expect(result.clips[0]!.startMs).toBe(1000);
      expect(result.clips[0]!.endMs).toBe(3000);

      expect(result.clips[1]!.startMs).toBe(9000);
      expect(result.clips[1]!.endMs).toBe(11000);
    });

    it('places flow segments relative to previous clip end plus pauseAfterMs', () => {
      const result = buildTimeline(mockScript as any, () => 2000, 'none');

      // First block has durationMs: 24000, so second block starts at 24000
      expect(result.clips[2]!.startMs).toBe(24000);
      expect(result.clips[2]!.endMs).toBe(26000); // 24000 + 2000

      // pauseAfterMs: 3000 -> next starts at 26000 + 3000 = 29000
      expect(result.clips[3]!.startMs).toBe(29000);
      expect(result.clips[3]!.endMs).toBe(31000);
    });

    it('generates accurate cues matching blocks', () => {
      const result = buildTimeline(mockScript as any, () => 2000, 'focus');

      expect(result.cues).toHaveLength(3); // settle + flow_block + outro_focus
      expect(result.cues[0]).toEqual({
        type: 'body',
        label: 'Settle in',
        startMs: 0,
        endMs: 24_000,
      });

      expect(result.cues[2]!.type).toBe('outro');
      expect((result.cues[2] as any)!.label).toBe('Awaken');
    });

    it('throws on anchored block overrun', () => {
      const brokenScript = {
        id: 'test_overrun',
        targetMs: 60_000,
        blocks: [
          {
            id: 'short_block',
            cue: { type: 'body' },
            durationMs: 5000,
            segments: [{ text: 'Long clip', atMs: 0 }],
          },
        ],
      };

      // Clip duration is 10s, exceeding 5s durationMs
      expect(() => buildTimeline(brokenScript as any, () => 10_000, 'none')).toThrow(/overrun/);
    });
  });

  describe('FFmpeg Command Builders', () => {
    it('builds trim command preserving 50ms breath onsets and edge fades', () => {
      const cmd = buildTrimClipCommand('in.wav', 'out.wav');
      expect(cmd).toContain(
        'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse,afade=t=in:d=0.01,areverse,afade=t=in:d=0.02,areverse',
      );
      expect(cmd).toContain('48000');
    });

    it('builds room tone generator using pink noise with highpass and lowpass filters', () => {
      const cmd = buildRoomToneCommand('room.wav', 300);
      expect(cmd.join(' ')).toContain('anoisesrc=d=300:c=pink:r=48000:a=0.0015');
      expect(cmd.join(' ')).toContain('highpass=f=80,lowpass=f=3500');
    });

    it('builds mix command with delay complex filter', () => {
      const cmd = buildMixCommand(
        'room.wav',
        [
          { path: 'c1.wav', startMs: 1000 },
          { path: 'c2.wav', startMs: 9000 },
        ],
        'mix.wav',
        300,
      );

      const str = cmd.join(' ');
      expect(str).toContain('adelay=1000');
      expect(str).toContain('adelay=9000');
      expect(str).toContain('amix=inputs=3:normalize=0:duration=first');
    });

    it('builds loudnorm measure command', () => {
      const cmd = buildLoudnormMeasureCommand('in.wav');
      const str = cmd.join(' ');
      expect(str).toContain('loudnorm=I=-18:TP=-1.5:LRA=7:print_format=json');
      expect(cmd).toContain('-f');
      expect(cmd).toContain('null');
    });

    it('builds loudnorm apply and Opus encoding command with apad padding', () => {
      const measured = {
        input_i: '-20.66',
        input_tp: '-1.99',
        input_lra: '6.70',
        input_thresh: '-31.15',
        target_offset: '-0.10',
      };
      const cmd = buildLoudnormApplyAndEncodeCommand('in.wav', measured, 'out.ogg', 300);
      const str = cmd.join(' ');

      expect(str).toContain('measured_I=-20.66');
      expect(str).toContain('measured_TP=-1.99');
      expect(str).toContain('apad=whole_dur=300');
      expect(str).toContain('libopus');
    });

    it('builds noise crossfade command for ambient beds', () => {
      const cmd = buildNoiseCrossfadeCommand('in.wav', 'loop.ogg', 60);
      expect(cmd).toContain('libopus');
      expect(cmd).toContain('96k');
    });

    it('builds FLAC lossless command with 22.05 kHz stereo', () => {
      const cmd = buildFlacEncodeCommand('in.wav', 'out.flac');
      expect(cmd).toContain('flac');
      expect(cmd).toContain('22050');
    });
  });

  describe('VoiceStudio Adapter', () => {
    const config = {
      baseUrl: 'http://127.0.0.1:8000',
      endpoint: '/v1/audio/speech',
      responseFormat: 'wav',
      apiKeyEnv: 'TEST_API_KEY',
      voices: {
        maya_warm: {
          name: 'Maya',
          model: 'tts-1-hd',
          voice: 'maya_v1',
          speed: 0.9,
        },
      },
    };

    it('generates consistent deterministic cache keys', () => {
      const adapter = new VoiceStudioAdapter(config);
      const key1 = adapter.key('maya_warm', 'Welcome to Ember.');
      const key2 = adapter.key('maya_warm', 'Welcome to Ember.');
      const key3 = adapter.key('maya_warm', 'Different text.');

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('throws when voiceId is unknown', () => {
      const adapter = new VoiceStudioAdapter(config);
      expect(() => adapter.key('unknown_voice', 'Hello')).toThrow(/Unknown voice ID/);
    });
  });
});
