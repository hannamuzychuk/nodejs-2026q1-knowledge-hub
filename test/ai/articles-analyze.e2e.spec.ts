import { StatusCodes } from 'http-status-codes';
import { request } from '../lib';
import { articlesRoutes, aiRoutes } from '../endpoints';
import {
  getTokenAndUserId,
  shouldAuthorizationBeTested,
  removeTokenUser,
} from '../utils';

const missingArticleId = '0a35dd62-e09f-444b-a628-f4e7c6954f57';

const analyzeBody = { task: 'review' as const };

const minimalArticle = {
  title: 'AI analyze e2e',
  content: 'Short article body for structured analysis smoke test.',
  status: 'published' as const,
  authorId: null as string | null,
  categoryId: null as string | null,
  tags: [] as string[],
};

const runAuth = shouldAuthorizationBeTested ? describe : describe.skip;

runAuth('AI analyze (e2e)', () => {
  const unauthorizedRequest = request;
  const commonHeaders: Record<string, string> = { Accept: 'application/json' };
  let mockUserId: string | undefined;

  beforeAll(async () => {
    const result = await getTokenAndUserId(unauthorizedRequest);
    commonHeaders.Authorization = result.token;
    mockUserId = result.mockUserId;
  });

  afterAll(async () => {
    if (mockUserId) {
      await removeTokenUser(unauthorizedRequest, mockUserId, commonHeaders);
    }
    delete commonHeaders.Authorization;
  });

  it('returns UNAUTHORIZED without bearer when auth is enforced', async () => {
    await unauthorizedRequest
      .post(aiRoutes.analyze(missingArticleId))
      .set({ Accept: 'application/json' })
      .send(analyzeBody)
      .expect(StatusCodes.UNAUTHORIZED);
  });

  it('returns BAD_REQUEST for invalid articleId param', async () => {
    await unauthorizedRequest
      .post(aiRoutes.analyze('not-a-uuid'))
      .set(commonHeaders)
      .send(analyzeBody)
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('returns NOT_FOUND when article id is valid UUID but not in DB', async () => {
    await unauthorizedRequest
      .post(aiRoutes.analyze(missingArticleId))
      .set(commonHeaders)
      .send(analyzeBody)
      .expect(StatusCodes.NOT_FOUND);
  });

  it('returns BAD_REQUEST for invalid analyze task enum', async () => {
    await unauthorizedRequest
      .post(aiRoutes.analyze(missingArticleId))
      .set(commonHeaders)
      .send({ task: 'not-a-valid-task' })
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('persisted article: 200 + analysis when Gemini works; otherwise AI-layer error (use GEMINI_E2E=1 to require 200)', async () => {
    const created = await unauthorizedRequest
      .post(articlesRoutes.create)
      .set(commonHeaders)
      .send(minimalArticle);

    expect(created.status).toBe(StatusCodes.CREATED);
    const articleId = created.body.id as string;

    try {
      const res = await unauthorizedRequest
        .post(aiRoutes.analyze(articleId))
        .set(commonHeaders)
        .send(analyzeBody);

      if (res.status === StatusCodes.OK) {
        expect(res.body.articleId).toBe(articleId);
        expect(typeof res.body.analysis).toBe('string');
        expect(res.body.analysis.length).toBeGreaterThan(0);
        expect(Array.isArray(res.body.suggestions)).toBe(true);
        expect(res.body.suggestions.length).toBeGreaterThan(0);
        expect(['info', 'warning', 'error']).toContain(res.body.severity);
        return;
      }

      if (process.env.GEMINI_E2E === '1') {
        expect(res.status).toBe(StatusCodes.OK);
        return;
      }

      expect(
        [
          StatusCodes.INTERNAL_SERVER_ERROR,
          StatusCodes.SERVICE_UNAVAILABLE,
          StatusCodes.BAD_GATEWAY,
          StatusCodes.TOO_MANY_REQUESTS,
        ],
      ).toContain(res.status);
    } finally {
      await unauthorizedRequest
        .delete(articlesRoutes.delete(articleId))
        .set(commonHeaders)
        .expect(StatusCodes.NO_CONTENT);
    }
  });
});
