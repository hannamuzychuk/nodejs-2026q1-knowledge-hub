import { StatusCodes } from 'http-status-codes';
import { request } from '../lib';
import { articlesRoutes, aiRoutes } from '../endpoints';
import {
  getTokenAndUserId,
  shouldAuthorizationBeTested,
  removeTokenUser,
} from '../utils';

const missingArticleId = '0a35dd62-e09f-444b-a628-f4e7c6954f57';

const translateBody = { targetLanguage: 'Polish' };

const minimalArticle = {
  title: 'AI translate e2e',
  content: 'Short English text for translation smoke test.',
  status: 'published' as const,
  authorId: null as string | null,
  categoryId: null as string | null,
  tags: [] as string[],
};

const runAuth = shouldAuthorizationBeTested ? describe : describe.skip;

runAuth('AI translate (e2e)', () => {
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
      .post(aiRoutes.translate(missingArticleId))
      .set({ Accept: 'application/json' })
      .send(translateBody)
      .expect(StatusCodes.UNAUTHORIZED);
  });

  it('returns BAD_REQUEST for invalid articleId param', async () => {
    await unauthorizedRequest
      .post(aiRoutes.translate('not-a-uuid'))
      .set(commonHeaders)
      .send(translateBody)
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('returns NOT_FOUND when article id is valid UUID but not in DB', async () => {
    await unauthorizedRequest
      .post(aiRoutes.translate(missingArticleId))
      .set(commonHeaders)
      .send(translateBody)
      .expect(StatusCodes.NOT_FOUND);
  });

  it('returns BAD_REQUEST when targetLanguage is missing', async () => {
    await unauthorizedRequest
      .post(aiRoutes.translate(missingArticleId))
      .set(commonHeaders)
      .send({})
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('persisted article: 200 + translate when Gemini works; otherwise AI-layer error (use GEMINI_E2E=1 to require 200)', async () => {
    const created = await unauthorizedRequest
      .post(articlesRoutes.create)
      .set(commonHeaders)
      .send(minimalArticle);

    expect(created.status).toBe(StatusCodes.CREATED);
    const articleId = created.body.id as string;

    try {
      const res = await unauthorizedRequest
        .post(aiRoutes.translate(articleId))
        .set(commonHeaders)
        .send(translateBody);

      if (res.status === StatusCodes.OK) {
        expect(res.body.articleId).toBe(articleId);
        expect(typeof res.body.translatedText).toBe('string');
        expect(res.body.translatedText.length).toBeGreaterThan(0);
        expect(typeof res.body.detectedLanguage).toBe('string');
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
