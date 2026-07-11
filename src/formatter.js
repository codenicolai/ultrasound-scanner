// src/formatter.js
// Converte o JSON retornado pela OpenAI em um laudo TXT estruturado.

const line = (char = '=', n = 60) => char.repeat(n);

const section = (title) => `\n${line('-')}\n${title.toUpperCase()}\n${line('-')}\n`;

const kv = (label, value) => {
  if (value === undefined || value === null || value === '') return '';
  return `${label.padEnd(24, ' ')}: ${value}\n`;
};

const hasAnyValue = (obj) =>
  obj && typeof obj === 'object' && Object.values(obj).some((v) => v !== '' && v != null);

/**
 * Gera o texto do laudo a partir do objeto extraído.
 * @param {Object} data - objeto retornado por extractFromImage
 * @param {string} filename - nome do arquivo original (para cabeçalho)
 */
export function formatReport(data, filename = '') {
  const out = [];

  out.push(line('='));
  out.push('LAUDO DE ULTRASSOM — EXTRAÇÃO AUTOMATIZADA');
  out.push(line('='));
  out.push('');

  if (filename) out.push(kv('Arquivo', filename).trimEnd());
  out.push(kv('Tipo de exame', data.exam_type).trimEnd());
  out.push(kv('Equipamento', data.equipment).trimEnd());

  // PACIENTE
  if (hasAnyValue(data.patient)) {
    out.push(section('Paciente'));
    const p = data.patient;
    out.push(kv('Nome', p.name).trimEnd());
    out.push(kv('ID', p.id).trimEnd());
    out.push(kv('Idade', p.age).trimEnd());
    out.push(kv('Sexo', p.gender).trimEnd());
    out.push(kv('Data de nascimento', p.birth_date).trimEnd());
  }

  // EXAME
  if (hasAnyValue(data.exam_info)) {
    out.push(section('Informações do exame'));
    const e = data.exam_info;
    out.push(kv('Data', e.date).trimEnd());
    out.push(kv('Hora', e.time).trimEnd());
    out.push(kv('Clínica', e.clinic).trimEnd());
    out.push(kv('Médico solicitante', e.requesting_physician).trimEnd());
    out.push(kv('Médico executante', e.performing_physician).trimEnd());
  }

  // MEDIDAS (suporta measurement_groups OU measurements legado)
  const groups = Array.isArray(data.measurement_groups) && data.measurement_groups.length
    ? data.measurement_groups
    : Array.isArray(data.measurements) && data.measurements.length
      ? [{ group: '', measurements: data.measurements }]
      : [];

  if (groups.length) {
    out.push(section('Medidas'));

    // Calcula largura global das colunas para alinhamento entre grupos
    const allMs = groups.flatMap((g) => g.measurements || []);
    const maxLabel = Math.max(...allMs.map((m) => (m.label || '').length), 0);
    const maxValUnit = Math.max(
      ...allMs.map((m) => `${m.value || ''} ${m.unit || ''}`.trim().length),
      0
    );

    groups.forEach((g, idx) => {
      const ms = Array.isArray(g.measurements) ? g.measurements : [];
      if (!ms.length) return;

      if (groups.length > 1 || g.group) {
        const gid = g.group || String(idx + 1);
        out.push(`\n  [ Grupo ${gid} ]`);
      }
      for (const m of ms) {
        const label = (m.label || '').padEnd(maxLabel + 2, ' ');
        const val = `${m.value || ''} ${m.unit || ''}`.trim().padEnd(maxValUnit + 2, ' ');
        const ref = m.reference ? `(ref.: ${m.reference})` : '';
        out.push(`  ${label}${val}${ref}`.trimEnd());
      }
    });
  }

  // ANOTAÇÕES
  if (Array.isArray(data.annotations) && data.annotations.length) {
    out.push(section('Anotações na imagem'));
    for (const a of data.annotations) out.push(`  • ${a}`);
  }

  // ESCALA
  if (data.scale_info) {
    out.push(section('Escala / Legendas'));
    out.push(`  ${data.scale_info}`);
  }

  // TEXTO BRUTO
  if (data.raw_text) {
    out.push(section('Transcrição bruta (OCR)'));
    out.push(data.raw_text.trim());
  }

  out.push('');
  out.push(line('='));
  out.push(`Gerado em ${new Date().toLocaleString('pt-BR')}`);
  out.push(line('='));

  // Remove linhas totalmente vazias duplicadas
  return out.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}

/**
 * Gera um nome de arquivo TXT a partir do nome original da imagem.
 */
export function toTxtName(originalName) {
  const base = originalName.replace(/\.[^.]+$/, '');
  return `${base}.laudo.txt`;
}

/**
 * Junta vários laudos já formatados em um único TXT, separados por
 * divisores e com um cabeçalho de índice.
 * @param {Array<{ name: string, txt: string }>} reports
 */
export function joinReports(reports) {
  if (!reports.length) return '';

  const out = [];
  out.push(line('='));
  out.push('LAUDOS DE ULTRASSOM — RELATÓRIO CONSOLIDADO');
  out.push(line('='));
  out.push(`Gerado em : ${new Date().toLocaleString('pt-BR')}`);
  out.push(`Total     : ${reports.length} laudo(s)`);
  out.push('');
  out.push('Índice:');
  reports.forEach((r, i) => {
    out.push(`  ${String(i + 1).padStart(2, '0')}. ${r.name}`);
  });
  out.push('');

  reports.forEach((r, i) => {
    out.push('');
    out.push(line('#'));
    out.push(`### LAUDO ${i + 1} de ${reports.length} — ${r.name}`);
    out.push(line('#'));
    out.push('');
    out.push(r.txt);
    out.push('');
  });

  return out.join('\n');
}
