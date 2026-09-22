import { ElevenLabsTranscriptionResponse, ElevenLabsWord } from '@/types';

/**
 * Service to interface with ElevenLabs Scribe Speech-to-Text API
 * Provides fast cloud transcription with word-level timecodes for retention metrics.
 */
export class ElevenLabsService {
  private apiKey: string;
  private modelId: string;

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || '';
    this.modelId = process.env.ELEVENLABS_STT_MODEL || 'scribe_v1';
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && !this.apiKey.includes('your_elevenlabs_api_key'));
  }

  /**
   * Calculate retention intelligence metrics from word-level timestamps:
   * - Words Per Minute (WPM)
   * - Dead air gaps (>0.4s silence)
   * - Hook WPM (0-30s urgency)
   */
  public calculateMetrics(words: ElevenLabsWord[], durationSeconds?: number) {
    const spokenWords = words.filter(w => w.type === 'word' || !w.type);
    const totalWords = spokenWords.length;

    if (totalWords === 0) {
      return {
        totalWords: 0,
        durationSeconds: durationSeconds || 0,
        wordsPerMinute: 0,
        deadAirCount: 0,
        deadAirTotalSec: 0,
        deadAirPercentage: 0,
        hookWpm: 0
      };
    }

    const calculatedDuration = durationSeconds || 
      Math.max(...spokenWords.map(w => w.end), 1);
    
    const minutes = calculatedDuration / 60;
    const wordsPerMinute = Math.round(totalWords / (minutes || 1));

    // Silence detection: Gaps > 0.4s between consecutive words
    let deadAirCount = 0;
    let deadAirTotalSec = 0;

    for (let i = 1; i < spokenWords.length; i++) {
      const prevEnd = spokenWords[i - 1].end;
      const currentStart = spokenWords[i].start;
      const gap = currentStart - prevEnd;

      if (gap > 0.4) {
        deadAirCount++;
        deadAirTotalSec += gap;
      }
    }

    const deadAirPercentage = Math.round((deadAirTotalSec / calculatedDuration) * 100);

    // Hook WPM (First 30 seconds)
    const hookWords = spokenWords.filter(w => w.end <= 30);
    const hookMinutes = Math.min(calculatedDuration, 30) / 60;
    const hookWpm = hookMinutes > 0 ? Math.round(hookWords.length / hookMinutes) : wordsPerMinute;

    return {
      totalWords,
      durationSeconds: Math.round(calculatedDuration * 10) / 10,
      wordsPerMinute,
      deadAirCount,
      deadAirTotalSec: Math.round(deadAirTotalSec * 10) / 10,
      deadAirPercentage,
      hookWpm
    };
  }

  /**
   * Transcribes an audio buffer or file blob using ElevenLabs Scribe API
   */
  public async transcribeAudio(
    audioBlob: Blob | Buffer, 
    fileName: string = 'audio.mp3'
  ): Promise<ElevenLabsTranscriptionResponse> {
    if (!this.isConfigured()) {
      // High-fidelity fallback for local testing without active API key
      return this.getMockTranscription();
    }

    const formData = new FormData();
    if (Buffer.isBuffer(audioBlob)) {
      formData.append('file', new Blob([new Uint8Array(audioBlob)]), fileName);
    } else {
      formData.append('file', audioBlob, fileName);
    }

    formData.append('model_id', this.modelId);
    formData.append('timestamps_granularity', 'word');
    formData.append('tag_audio_events', 'true');
    formData.append('diarize', 'true');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs STT API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const words: ElevenLabsWord[] = data.words || [];
    const metrics = this.calculateMetrics(words);

    return {
      language_code: data.language_code || 'en',
      language_probability: data.language_probability || 1,
      text: data.text || '',
      words,
      calculatedMetrics: metrics
    };
  }

  /**
   * Mock transcription for development & seed testing
   */
  public getMockTranscription(): ElevenLabsTranscriptionResponse {
    const rawWords: ElevenLabsWord[] = [
      { text: "Is", start: 0.1, end: 0.3, type: "word" },
      { text: "it", start: 0.3, end: 0.5, type: "word" },
      { text: "possible", start: 0.5, end: 0.9, type: "word" },
      { text: "to", start: 0.9, end: 1.1, type: "word" },
      { text: "master", start: 1.1, end: 1.5, type: "word" },
      { text: "Apple-style", start: 1.5, end: 2.1, type: "word" },
      { text: "motion", start: 2.1, end: 2.4, type: "word" },
      { text: "graphics", start: 2.4, end: 2.9, type: "word" },
      { text: "under", start: 2.9, end: 3.2, type: "word" },
      { text: "20", start: 3.2, end: 3.5, type: "word" },
      { text: "minutes?", start: 3.5, end: 4.1, type: "word" },
      { text: "Well,", start: 4.3, end: 4.7, type: "word" },
      { text: "yes.", start: 4.7, end: 5.1, type: "word" },
      { text: "And", start: 5.2, end: 5.4, type: "word" },
      { text: "in", start: 5.4, end: 5.6, type: "word" },
      { text: "this", start: 5.6, end: 5.8, type: "word" },
      { text: "tutorial,", start: 5.8, end: 6.3, type: "word" },
      { text: "you'll", start: 6.3, end: 6.6, type: "word" },
      { text: "find", start: 6.6, end: 6.9, type: "word" },
      { text: "out", start: 6.9, end: 7.1, type: "word" },
      { text: "how", start: 7.1, end: 7.3, type: "word" },
      { text: "to", start: 7.3, end: 7.5, type: "word" },
      { text: "do", start: 7.5, end: 7.7, type: "word" },
      { text: "it.", start: 7.7, end: 8.0, type: "word" }
    ];

    const metrics = this.calculateMetrics(rawWords, 8.0);

    return {
      language_code: "en",
      language_probability: 0.99,
      text: "Is it possible to master Apple-style motion graphics under 20 minutes? Well, yes. And in this tutorial, you'll find out how to do it.",
      words: rawWords,
      calculatedMetrics: metrics
    };
  }
}

export const elevenlabsService = new ElevenLabsService();
