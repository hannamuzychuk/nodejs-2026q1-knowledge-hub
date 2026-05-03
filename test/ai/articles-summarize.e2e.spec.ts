import { StatusCodes } from 'http-status-codes';
import { request } from '../lib';
import { articlesRoutes, aiRoutes } from '../endpoints';
import {
  getTokenAndUserId,
  shouldAuthorizationBeTested,
  removeTokenUser,
} from '../utils';

const missingArticleId = '0a35dd62-e09f-444b-a628-f4e7c6954f57';

const minimalArticle = {
  title: 'AI summarize e2e',
  content: 'Short body for summarize smoke test.',
  status: 'published' as const,
  authorId: null as string | null,
  categoryId: null as string | null,
  tags: [] as string[],
};

const runAuth = shouldAuthorizationBeTested ? describe : describe.skip;

runAuth('AI summarize (e2e)', () => {
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
      .post(aiRoutes.summarize(missingArticleId))
      .set({ Accept: 'application/json' })
      .send({ maxLength: 'short' })
      .expect(StatusCodes.UNAUTHORIZED);
  });

  it('returns BAD_REQUEST for invalid articleId param', async () => {
    await unauthorizedRequest
      .post(aiRoutes.summarize('not-a-uuid'))
      .set(commonHeaders)
      .send({ maxLength: 'short' })
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('returns NOT_FOUND when article id is valid UUID but not in DB', async () => {
    await unauthorizedRequest
      .post(aiRoutes.summarize(missingArticleId))
      .set(commonHeaders)
      .send({ maxLength: 'short' })
      .expect(StatusCodes.NOT_FOUND);
  });

  it('returns BAD_REQUEST for invalid summarize maxLength enum', async () => {
    await unauthorizedRequest
      .post(aiRoutes.summarize(missingArticleId))
      .set(commonHeaders)
      .send({ maxLength: 'not-a-valid-length' })
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('persisted article: 200 + summary when Gemini works; otherwise AI-layer error (use GEMINI_E2E=1 to require 200)', async () => {
    const created = await unauthorizedRequest
      .post(articlesRoutes.create)
      .set(commonHeaders)
      .send(minimalArticle);

    expect(created.status).toBe(StatusCodes.CREATED);
    const articleId = created.body.id as string;

    try {
      const res = await unauthorizedRequest
        .post(aiRoutes.summarize(articleId))
        .set(commonHeaders)
        .send({ maxLength: 'short' });

      if (res.status === StatusCodes.OK) {
        expect(res.body.articleId).toBe(articleId);
        expect(typeof res.body.summary).toBe('string');
        expect(res.body.summary.length).toBeGreaterThan(0);
        expect(typeof res.body.originalLength).toBe('number');
        expect(typeof res.body.summaryLength).toBe('number');
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

