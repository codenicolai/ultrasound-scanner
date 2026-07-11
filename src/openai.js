// src/openai.js
// Integração com OpenAI Chat Completions (visão).

import { CONFIG } from '../config.js';
import { SYSTEM_PROMPT, JSON_SCHEMA_INSTRUCTION, parseJsonLoose } from './prompts.js';

const API_URL = 'https://api.openai.com/v1/chat/completions';

export const PROVIDER_NAME = 'OpenAI';

export function isAvailable() {
  const k = CONFIG.OPENAI_API_KEY;
  return !!k && k.trim() !== '' && k !== 'COLE_SUA_CHAVE_AQUI';
}

export async function extractFromImage(dataUrl) {
  if (!isAvailable()) {
    throw new Error('Chave OpenAI ausente.');
  }

  const body = {
    model: CONFIG.OPENAI_MODEL,
    temperature: CONFIG.TEMPERATURE,
    max_tokens: CONFIG.MAX_TOKENS,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: JSON_SCHEMA_INSTRUCTION },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Resposta vazia da OpenAI.');
  return parseJsonLoose(content);
}
