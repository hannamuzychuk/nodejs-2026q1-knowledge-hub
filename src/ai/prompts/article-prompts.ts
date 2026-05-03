import {
  AnalyzeTaskOption,
  severityOptions,
} from '../dto/analyze-article.dto';
import { SummaryLengthOption } from '../dto/summarize-article.dto';

const summaryLengthHints: Record<SummaryLengthOption, string> = {
  short: 'Use 1-2 concise sentences.',
  medium: 'Use one compact paragraph with key points.',
  detailed: 'Use 2-3 short paragraphs with key facts and context.',
};

export const buildSummarizePrompt = (
  articleTitle: string,
  articleContent: string,
  maxLength: SummaryLengthOption,
) => `
Summarize the article below.

Rules:
- Keep the summary factual and based only on the source.
- ${summaryLengthHints[maxLength]}
- Return plain text only.

Title: ${articleTitle}
Content:
${articleContent}
`;

export const buildTranslatePrompt = (
  articleTitle: string,
  articleContent: string,
  targetLanguage: string,
  sourceLanguage?: string,
) => `
Translate the following article to "${targetLanguage}".

Rules:
- Preserve technical meaning.
- Keep markdown or code snippets intact when possible.
- Detect language when source language is unknown.
- Return valid JSON only with this shape:
{
  "translatedText": "string",
  "detectedLanguage": "string"
}

${sourceLanguage ? `Source language: ${sourceLanguage}` : ''}
Title: ${articleTitle}
Content:
${articleContent}
`;

export const buildAnalyzePrompt = (
  articleTitle: string,
  articleContent: string,
  task: AnalyzeTaskOption,
) => `
Analyze this article content with task "${task}".

Rules:
- Focus on practical insights.
- Return valid JSON only with this shape:
{
  "analysis": "string",
  "suggestions": ["string"],
  "severity": "one of ${severityOptions.join(', ')}"
}
- "suggestions" should contain 2-6 actionable items.

Title: ${articleTitle}
Content:
${articleContent}
`;
