import { validate } from 'class-validator';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { CreateArticleDto } from 'src/article/dto/create-article.dto';

describe('DTO validation', () => {
  it('fails when required fields are missing', async () => {
    const dto = new CreateUserDto();

    const errors = await validate(dto);
    const fields = errors.map((err) => err.property);

    expect(fields).toContain('login');
    expect(fields).toContain('password');
  });

  it('fails when enum value is invalid', async () => {
    const dto = Object.assign(new CreateArticleDto(), {
      title: 'Test',
      content: 'Body',
      status: 'wrong-status',
    });

    const errors = await validate(dto);
    const statusError = errors.find((err) => err.property === 'status');

    expect(statusError).toBeDefined();
  });

  it('passes when payload is valid', async () => {
    const dto = Object.assign(new CreateUserDto(), {
      login: 'jane',
      password: 'secret123',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
