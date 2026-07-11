# Ultrasson Reader

OCR de laudos/imagens de ultrassom usando **OpenAI Vision** diretamente do
navegador. Sem backend, sem servidor — só HTML + JS puro.

## Providers suportados (com fallback automático)

| Ordem | Provider | Plano | Modelo padrão | Como pegar a chave |
|-------|----------|-------|---------------|--------------------|
| 1º    | **OpenAI** (primário) | Pago   | `gpt-4o`            | https://platform.openai.com/api-keys |
| 2º    | **Google Gemini** (fallback) | Freemium (~15 RPM, ~1500 req/dia) | `gemini-1.5-flash` | https://aistudio.google.com/apikey |

O sistema usa OpenAI se a chave dela estiver preenchida. Se não, cai
automaticamente no Gemini. Só precisa **uma** das duas.

## Como usar

1. **Configure pelo menos uma chave** — edite `config.js`:

   ```js
   OPENAI_API_KEY: 'sk-...'      // opcional
   GEMINI_API_KEY: 'AIza...'     // opcional (usado se OpenAI estiver vazio)
   ```

   O arquivo `config.js` está no `.gitignore` e nunca é commitado.

2. **Abra o app** — duas opções:

   **a) Como app desktop (Electron, recomendado):**

   ```bash
   npm install
   npm run start
   ```

   Abre uma janela nativa carregando o `index.html`. Sem precisar de browser.

   **b) Como página servida (browser):**

   ```bash
   npm run serve
   # ou:
   python3 -m http.server 8000
   ```

   Abra `http://localhost:3000` (ou `:8000`) no navegador.

3. **Arraste imagens** (PNG/JPG/etc.) para a dropzone ou clique para selecionar.
   Suporta múltiplos arquivos de uma vez.

4. **Clique em "Processar todas"**. Cada imagem é enviada para o GPT-4o com um
   prompt especializado em ultrassom — a resposta vem em JSON estruturado e é
   convertida para um laudo `.txt` em seções.

5. **Baixe individualmente** ou use **"Baixar tudo (.zip)"** para um pacote.

## O que o sistema extrai

- **Tipo de exame** (Ecocardiograma Doppler, M-mode, Obstétrico, etc.)
- **Equipamento** (GE, Philips, etc.)
- **Paciente** (se visível no cabeçalho)
- **Grupos de medidas numerados** (caixas 1, 2, ...) com label/valor/unidade
- **Anotações** (setas com rótulo, como "Insuf. Mitral", "SIV")
- **Escala/legendas** (ex.: "cm/s", "200 mm/s")
- **Transcrição bruta** (raw OCR linha a linha)

Preserva abreviações médicas exatamente como aparecem: `SIVd`, `DIVEd`,
`FE(Teich)`, `Vmáx VA`, `PG máx. VA`, `%Delta D`, `Veloc. E VM`, `AVM`, etc.

## Exemplo de saída

```
============================================================
LAUDO DE ULTRASSOM — EXTRAÇÃO AUTOMATIZADA
============================================================
Arquivo        : doppler_vm.png
Tipo de exame  : Ecocardiograma Doppler - Valva Mitral
Equipamento    : GE

------------------------------------------------------------
MEDIDAS
------------------------------------------------------------
  [ Grupo 1 ]
  Veloc. E VM     0.56 m/s
  T. desac. VM    68.51 ms
  Rampa Des VM    8.21 m/s²
  Velocid. A VM   0.45 m/s
  Relação E/A VM  1.25
  PHT VM          19.87 ms
  AVM             11.07 cm²
```

## Build do executável (Electron)

O projeto vem encapsulado em **Electron**. Pra gerar um instalador/binário pra
sua plataforma, basta:

```bash
# 1. instala deps (electron + electron-builder)
npm install

# 2. roda o app em modo dev (abre janela já com DevTools)
npm run start

# 3. gera o build pra plataforma atual (saída em ./dist)
npm run build
```

Builds direcionados a uma plataforma específica:

```bash
npm run build:mac     # gera .dmg + .zip (Apple Silicon + Intel)   → dist/
npm run build:win     # gera .exe (NSIS installer + portable x64)  → dist/
npm run build:linux   # gera .AppImage x64                         → dist/
```

Notas:

- **Cross-compile** (gerar `.exe` no Mac, por exemplo) funciona pra builds não
  assinados. Pro Windows, o `electron-builder` baixa o Wine na 1ª execução
  se não tiver — em alguns casos é mais confiável buildar dentro de uma VM
  Windows ou via GitHub Actions.
- O `dist/` está no `.gitignore` — nada commitado.
- O `config.js` é **incluído** no bundle, então a chave que estiver lá vai
  junto no executável. Se for distribuir o binário, troque/zere as chaves
  antes de buildar.
- Pra iniciar a app já buildada: abre o `.dmg`/`.exe`/`.AppImage` em `dist/`
  e instala/executa normal.

## Estrutura

```
ultrasson_reader/
├── main.js               processo principal Electron (BrowserWindow)
├── index.html            UI (dropzone, cards, botões)
├── config.js             ⚠️  suas chaves (gitignored)
├── config.example.js     template — copie p/ config.js
├── src/
│   ├── app.js            orquestração (upload, batch, download)
│   ├── ocr.js            dispatcher: escolhe provider (OpenAI → Gemini → Groq)
│   ├── openai.js         provider OpenAI (Chat Completions + Vision)
│   ├── gemini.js         provider Gemini (generateContent + inline_data)
│   ├── groq.js           provider Groq (Llama Vision, free)
│   ├── prompts.js        prompt + schema compartilhados + utils
│   └── formatter.js      JSON → laudo .txt em seções
├── package.json          deps + scripts + config do electron-builder
└── dist/                 saída do build (gitignored)
```

## Personalização

- **Modelo OpenAI**: troque `OPENAI_MODEL` para `gpt-4o-mini` (mais barato)
- **Modelo Gemini**: troque `GEMINI_MODEL` para `gemini-2.0-flash` (mais novo)
  ou `gemini-1.5-pro` (qualidade mais alta — consumo maior)
- **Temperatura/tokens**: ajuste em `config.js`
- **Schema do JSON**: edite `JSON_SCHEMA_INSTRUCTION` em `src/prompts.js`
- **Layout do TXT**: edite `formatReport()` em `src/formatter.js`
- **Forçar Gemini** mesmo tendo chave OpenAI: deixe `OPENAI_API_KEY: ''`

## Segurança

- A chave da OpenAI fica APENAS no `config.js` local — não sai do seu computador
  a não ser nas chamadas à própria API OpenAI.
- **Nunca commite `config.js`.** O `.gitignore` já protege.
- Para uso multi-usuário (expor publicamente), coloque um proxy simples na
  frente pra esconder a chave — mas isso é "backend" e sai do escopo atual.
