// src/gemini.js
// Integração com Google Gemini (generateContent).
// Free tier: ~15 RPM, ~1500 req/dia em gemini-1.5-flash.

import { CONFIG } from '../config.js';
import {
  SYSTEM_PROMPT,
  JSON_SCHEMA_INSTRUCTION,
  parseJsonLoose,
  splitDataUrl,
} from './prompts.js';

export const PROVIDER_NAME = 'Gemini';

export function isAvailable() {
  const k = CONFIG.GEMINI_API_KEY;
  return !!k && k.trim() !== '' && k !== 'COLE_SUA_CHAVE_GEMINI_AQUI';
}

export async function extractFromImage(dataUrl) {
  if (!isAvailable()) {
    throw new Error('Chave Gemini ausente.');
  }

  const { mimeType, base64 } = splitDataUrl(dataUrl);
  const model = CONFIG.GEMINI_MODEL || 'gemini-1.5-flash';
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Gemini não tem "system role" explícito nessa rota; concatenamos no prompt.
  const prompt = `${SYSTEM_PROMPT}\n\n${JSON_SCHEMA_INSTRUCTION}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: CONFIG.TEMPERATURE ?? 0,
      maxOutputTokens: CONFIG.MAX_TOKENS ?? 2000,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': CONFIG.GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    // 404 = modelo não encontrado / descontinuado. Oferece dica útil.
    if (res.status === 404) {
      throw new Error(
        `Gemini 404: modelo "${model}" não disponível na sua conta.\n` +
        `Tente trocar GEMINI_MODEL em config.js para um destes (free tier):\n` +
        `  • gemini-2.0-flash\n  • gemini-2.5-flash\n  • gemini-flash-latest\n` +
        `Listar os modelos da sua chave:\n` +
        `  curl "https://generativelanguage.googleapis.com/v1beta/models?key=SUA_CHAVE"\n\n` +
        `Resposta original: ${errText}`
      );
    }
    throw new Error(`Gemini ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join('\n')
    ?.trim();

  if (!text) {
    // Gemini pode retornar "finishReason: SAFETY" e sem text
    const reason = json.candidates?.[0]?.finishReason || 'desconhecido';
    throw new Error(`Resposta vazia do Gemini (finishReason=${reason}).`);
  }
  return parseJsonLoose(text);
}
