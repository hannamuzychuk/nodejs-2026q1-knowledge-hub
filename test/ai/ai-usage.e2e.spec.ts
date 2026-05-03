import { StatusCodes } from 'http-status-codes';
import { request } from '../lib';
import { aiRoutes } from '../endpoints';
import {
  getTokenAndUserId,
  shouldAuthorizationBeTested,
  removeTokenUser,
} from '../utils';

const runAuth = shouldAuthorizationBeTested ? describe : describe.skip;

runAuth('AI usage snapshot (e2e)', () => {
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
      .get(aiRoutes.usage())
      .set({ Accept: 'application/json' })
      .expect(StatusCodes.UNAUTHORIZED);
  });

  it('returns usage snapshot with totals and per-endpoint counters', async () => {
    const res = await unauthorizedRequest
      .get(aiRoutes.usage())
      .set(commonHeaders)
      .expect(StatusCodes.OK);

    expect(res.body).toMatchObject({
      totalRequests: expect.any(Number),
      requestsByEndpoint: expect.any(Object),
      totalTokens: expect.any(Number),
      tokensByEndpoint: expect.any(Object),
      observability: expect.objectContaining({
        cacheHitRatio: expect.any(Object),
        cacheEvents: expect.any(Object),
        geminiLatencyMsByEndpoint: expect.any(Object),
        activeAiSessions: expect.any(Number),
      }),
    });
  });
});
