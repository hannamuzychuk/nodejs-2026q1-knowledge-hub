import { severityOptions } from '../dto/analyze-article.dto';

type JsonMap = Record<string, unknown>;

const tryParseJsonMap = (input: string): JsonMap => {
  const cleaned = input
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    const v = JSON.parse(cleaned) as unknown;
    return typeof v === 'object' && v !== null && !Array.isArray(v)
      ? (v as JsonMap)
      : {};
  } catch {
    return {};
  }
};

const readNonEmptyString = (source: JsonMap, key: string): string | null => {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return value.trim();
};

const readStringArray = (source: JsonMap, key: string): string[] | null => {
  const value = source[key];
  if (!Array.isArray(value)) {
    return null;
  }
  const out = value.filter(
    (item): item is string =>
      typeof item === 'string' && item.trim().length > 0,
  );
  return out;
};

/**
 * If the model returned JSON `{ "summary": "..." }`, use it; otherwise treat the whole body as summary.
 */
export function normalizeSummarizeOutput(rawModelText: string): string {
  const map = tryParseJsonMap(rawModelText);
  const fromSchema = readNonEmptyString(map, 'summary');
  if (fromSchema) {
    return fromSchema;
  }
  return rawModelText.trim();
}

export function validateTranslateStructured(rawModelText: string): {
  translatedText: string;
  detectedLanguage: string;
} {
  const map = tryParseJsonMap(rawModelText);
  const translatedText =
    readNonEmptyString(map, 'translatedText') ?? rawModelText.trim();
  const detectedLanguage =
    readNonEmptyString(map, 'detectedLanguage') ?? 'unknown';
  return { translatedText, detectedLanguage };
}

export function validateAnalyzeStructured(rawModelText: string): {
  analysis: string;
  suggestions: string[];
  severity: (typeof severityOptions)[number];
} {
  const map = tryParseJsonMap(rawModelText);
  const analysis = readNonEmptyString(map, 'analysis') ?? rawModelText.trim();
  const suggestionsRaw = readStringArray(map, 'suggestions');
  const suggestions =
    suggestionsRaw && suggestionsRaw.length > 0
      ? suggestionsRaw
      : ['No suggestions returned by AI.'];
  const severityRaw = readNonEmptyString(map, 'severity');
  const severity =
    severityRaw && (severityOptions as readonly string[]).includes(severityRaw)
      ? (severityRaw as (typeof severityOptions)[number])
      : 'info';
  return { analysis, suggestions, severity };
}
