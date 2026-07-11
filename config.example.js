// config.example.js
// -------------------------------------------------------------
// COPIE ESTE ARQUIVO PARA `config.js` E PREENCHA PELO MENOS UMA CHAVE.
// `config.js` está no .gitignore e NUNCA deve ser commitado.
// -------------------------------------------------------------
// Cadeia de fallback: OpenAI → Gemini → Groq.
// Basta preencher UMA das três chaves.
// -------------------------------------------------------------

export const CONFIG = {
	// 1º — OpenAI (pago)
	// https://platform.openai.com/api-keys
	OPENAI_API_KEY: "",
	OPENAI_MODEL: "gpt-4o",

	// 2º — Google Gemini (freemium, ~15 RPM / ~1500 req/dia grátis)
	// https://aistudio.google.com/apikey
	GEMINI_API_KEY: "",
	GEMINI_MODEL: "gemini-2.0-flash",

	// Comum
	LANGUAGE: "pt-BR",
	TEMPERATURE: 0,
	MAX_TOKENS: 2000,
};
