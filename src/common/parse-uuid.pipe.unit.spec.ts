import { ArgumentMetadata, BadRequestException, ParseUUIDPipe } from '@nestjs/common';

describe('ParseUUIDPipe', () => {
  const pipe = new ParseUUIDPipe({ errorHttpStatusCode: 400 });
  const metadata: ArgumentMetadata = { type: 'param', data: 'id', metatype: String };

  it('passes valid uuid', async () => {
    const value = '550e8400-e29b-41d4-a716-446655440000';
    await expect(pipe.transform(value, metadata)).resolves.toBe(value);
  });

  it('throws bad request for malformed value', async () => {
    await expect(pipe.transform('not-a-uuid', metadata)).rejects.toThrow(
      BadRequestException,
    );
  });
});
