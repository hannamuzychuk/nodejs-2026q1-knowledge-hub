import { describe, expect, it } from 'vitest';
import {
  normalizeSummarizeOutput,
  validateAnalyzeStructured,
  validateTranslateStructured,
} from './structured-ai-output';

describe('structured-ai-output', () => {
  it('normalizeSummarizeOutput prefers JSON summary field when present', () => {
    const raw = '{"summary": "Short."}';
    expect(normalizeSummarizeOutput(raw)).toBe('Short.');
  });

  it('normalizeSummarizeOutput falls back to full text when JSON invalid', () => {
    expect(normalizeSummarizeOutput('Plain summary')).toBe('Plain summary');
  });

  it('validateTranslateStructured falls back when JSON missing', () => {
    const t = validateTranslateStructured('only prose');
    expect(t.translatedText).toBe('only prose');
    expect(t.detectedLanguage).toBe('unknown');
  });

  it('validateTranslateStructured reads valid JSON', () => {
    const t = validateTranslateStructured(
      JSON.stringify({ translatedText: 'Cześć', detectedLanguage: 'pl' }),
    );
    expect(t).toEqual({ translatedText: 'Cześć', detectedLanguage: 'pl' });
  });

  it('validateAnalyzeStructured clamps severity and fills suggestions', () => {
    const a = validateAnalyzeStructured(
      JSON.stringify({
        analysis: 'OK',
        suggestions: ['a'],
        severity: 'nope',
      }),
    );
    expect(a.severity).toBe('info');
    expect(a.analysis).toBe('OK');
    expect(a.suggestions).toEqual(['a']);
  });

  it('validateAnalyzeStructured uses fallback suggestions when array missing', () => {
    const a = validateAnalyzeStructured('not json');
    expect(a.analysis).toBe('not json');
    expect(a.suggestions).toEqual(['No suggestions returned by AI.']);
  });
});
