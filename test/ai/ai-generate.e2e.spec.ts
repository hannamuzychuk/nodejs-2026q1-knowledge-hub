import { StatusCodes } from 'http-status-codes';
import { request } from '../lib';
import { aiRoutes } from '../endpoints';
import {
  getTokenAndUserId,
  shouldAuthorizationBeTested,
  removeTokenUser,
} from '../utils';

const runAuth = shouldAuthorizationBeTested ? describe : describe.skip;

runAuth('AI generate (e2e)', () => {
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
      .post(aiRoutes.generate())
      .set({ Accept: 'application/json' })
      .send({ prompt: 'hello' })
      .expect(StatusCodes.UNAUTHORIZED);
  });

  it('returns BAD_REQUEST when prompt is missing', async () => {
    await unauthorizedRequest
      .post(aiRoutes.generate())
      .set(commonHeaders)
      .send({})
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('returns BAD_REQUEST when sessionId is not a UUID', async () => {
    await unauthorizedRequest
      .post(aiRoutes.generate())
      .set(commonHeaders)
      .send({ prompt: 'hello', sessionId: 'not-uuid' })
      .expect(StatusCodes.BAD_REQUEST);
  });
});
