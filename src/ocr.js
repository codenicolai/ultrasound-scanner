// src/ocr.js
// Dispatcher: decide qual provider usar.
// Ordem: OpenAI (pago) → Gemini (freemium).
// O primeiro que tiver chave configurada é selecionado.

import * as openai from "./openai.js";
import * as gemini from "./gemini.js";
import { fileToDataURL } from "./prompts.js";

export { fileToDataURL };

const CHAIN = [
	{ mod: openai, label: "OpenAI (primário)" },
	{ mod: gemini, label: "Gemini (fallback 1)" },
];

/**
 * Seleciona o primeiro provider da cadeia com chave disponível.
 */
export function selectProvider() {
	for (const { mod, label } of CHAIN) {
		if (mod.isAvailable()) return { ...mod, name: mod.PROVIDER_NAME, label };
	}
	return null;
}

// Regex que identifica erros "transitórios" — onde faz sentido tentar o próximo
// provider. Cobre: rate limit (429), cota esgotada, billing, serviço indisponível.
const TRANSIENT_RX =
	/\b(429|quota|rate.?limit|exhaust|insufficient|billing|503|502|over.*cap)\b/i;

/**
 * Extrai dados da imagem. Tenta cada provider disponível na ordem da cadeia;
 * se o primeiro erra com rate limit / quota / 5xx, cai para o próximo.
 * Erros "duros" (chave inválida, 404 modelo, JSON inválido) interrompem na hora.
 */
export async function extractFromImage(dataUrl) {
	const active = CHAIN.filter(({ mod }) => mod.isAvailable());
	if (active.length === 0) {
		throw new Error(
			"Nenhum provider configurado. Preencha OPENAI_API_KEY ou GEMINI_API_KEY em config.js.",
		);
	}

	const errors = [];
	for (const { mod, label } of active) {
		try {
			return await mod.extractFromImage(dataUrl);
		} catch (err) {
			const msg = String(err?.message || err);
			errors.push(`${label}: ${msg.slice(0, 160)}`);
			if (!TRANSIENT_RX.test(msg)) throw err; // erro duro → propaga
			console.warn(`[ocr] ${label} falhou (cota/rate). Tentando próximo...`);
		}
	}
	// Todos os providers falharam por erros transitórios
	throw new Error(`Todos providers falharam:\n - ${errors.join("\n - ")}`);
}

/**
 * Descreve o status atual para a UI.
 */
export function providerStatus() {
	const p = selectProvider();
	if (p) {
		return {
			ok: true,
			label: `${p.name} ativo`,
			detail: `Usando ${p.label}. Para trocar, ajuste as chaves em config.js.`,
		};
	}
	return {
		ok: false,
		label: "Nenhuma chave configurada",
		detail:
			"Preencha OPENAI_API_KEY ou GEMINI_API_KEY em config.js.",
	};
}
