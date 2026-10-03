import OpenAI from 'openai';
import { TranscriptionProvider } from '@whiteboard/shared';

export class WhisperTranscriptionProvider implements TranscriptionProvider {
  name = 'openai-whisper';
  private client: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  async transcribe(params: {
    audioBuffer: Buffer | Uint8Array;
    mimeType: string;
    language?: string;
  }): Promise<{ text: string; segments?: Array<{ start: number; end: number; text: string }> }> {
    if (!this.client) {
      throw new Error(
        'Clé API OpenAI (OPENAI_API_KEY) absente. La transcription vocale nécessite une clé valide.'
      );
    }

    const file = new File([params.audioBuffer as any], 'audio.webm', {
      type: params.mimeType,
    });

    const transcription = await this.client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: params.language || 'fr',
      response_format: 'verbose_json',
    });

    return {
      text: transcription.text,
      segments: (transcription as any).segments?.map((s: any) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    };
  }
}

export const transcriptionProvider = new WhisperTranscriptionProvider();
