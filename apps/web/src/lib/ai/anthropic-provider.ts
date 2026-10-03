import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AIProvider } from '@whiteboard/shared';

export class AnthropicAIProvider implements AIProvider {
  name = 'anthropic-claude';
  private client: Anthropic | null = null;
  private model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    if (apiKey) {
      this.client = new Anthropic({
        apiKey,
        baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
      });
    }
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  async generateStructured<T>(params: {
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodType<T>;
  }): Promise<T> {
    if (!this.client) {
      throw new Error(
        'Clé API Anthropic (ANTHROPIC_API_KEY) absente. Veuillez configurer la variable d’environnement.'
      );
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: `${params.systemPrompt}\n\nIMPORTANT: Tu dois impérativement répondre avec un objet JSON valide et rien d'autre, sans balise markdown ni explication.`,
      messages: [
        {
          role: 'user',
          content: params.userPrompt,
        },
      ],
    });

    const textBlock = response.content.find((c) => c.type === 'text');
    if (!textBlock || !('text' in textBlock)) {
      throw new Error('Aucune réponse textuelle reçue de l’IA.');
    }

    let jsonStr = textBlock.text.trim();
    // Nettoyer si enveloppé de ```json ... ```
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(jsonStr);
    return params.schema.parse(parsed);
  }

  async analyzeImage<T>(params: {
    systemPrompt: string;
    userPrompt: string;
    imageBase64: string;
    mimeType: string;
    schema: z.ZodType<T>;
  }): Promise<T> {
    if (!this.client) {
      throw new Error('Clé API Anthropic (ANTHROPIC_API_KEY) absente.');
    }

    const validMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mediaType = (validMimes.includes(params.mimeType) ? params.mimeType : 'image/png') as
      | 'image/jpeg'
      | 'image/png'
      | 'image/gif'
      | 'image/webp';

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: `${params.systemPrompt}\n\nTu dois impérativement répondre avec un objet JSON valide et rien d'autre.`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: params.imageBase64,
              },
            },
            {
              type: 'text',
              text: params.userPrompt,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((c) => c.type === 'text');
    if (!textBlock || !('text' in textBlock)) {
      throw new Error('Aucune réponse reçue lors de l’analyse d’image.');
    }

    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(jsonStr);
    return params.schema.parse(parsed);
  }
}

export const aiProvider = new AnthropicAIProvider();
