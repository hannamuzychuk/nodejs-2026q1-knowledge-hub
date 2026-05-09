import { StatusCodes } from 'http-status-codes';
import { request } from '../lib';
import { ragRoutes } from '../endpoints';
import {
  getTokenAndUserId,
  removeTokenUser,
  shouldAuthorizationBeTested,
} from '../utils';

const runAuth = shouldAuthorizationBeTested ? describe : describe.skip;

runAuth('RAG endpoints (e2e)', () => {
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

  it('returns BAD_REQUEST when search query is missing', async () => {
    await unauthorizedRequest
      .post(ragRoutes.search())
      .set(commonHeaders)
      .send({})
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('returns BAD_REQUEST when chat question is missing', async () => {
    await unauthorizedRequest
      .post(ragRoutes.chat())
      .set(commonHeaders)
      .send({})
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('returns BAD_REQUEST when history conversationId is not UUID', async () => {
    await unauthorizedRequest
      .get(ragRoutes.history('not-uuid'))
      .set(commonHeaders)
      .expect(StatusCodes.BAD_REQUEST);
  });
});
