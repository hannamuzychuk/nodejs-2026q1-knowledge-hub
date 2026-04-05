import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DbService } from 'src/db/db.service';
import { randomUUID } from 'node:crypto';

@Injectable()
export class UserService {
  constructor(private db: DbService) {}

  create(dto: CreateUserDto) {
    const newUser = {
      id: randomUUID(),
      ...dto,
      role: dto.role || 'viewer',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.db.users.push(newUser);
    const { password, ...result } = newUser;
    return result;
  }

  findAll() {
    return this.db.users.map(({ password, ...user }) => user);
  }

  findOne(id: string) {
    const user = this.db.users.find((u) => u.id === id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...result } = user;
    return result;
  }

  update(id: string, dto: UpdateUserDto) {
    if (!dto.newPassword || !dto.oldPassword) {
      throw new BadRequestException('Invalid DTO');
    }

    const user = this.db.users.find((u) => u.id === id);
    if (!user) throw new NotFoundException('User not found');

    if (dto.oldPassword && dto.newPassword) {
      if (user.password !== dto.oldPassword) {
        throw new ForbiddenException('Old password is wrong');
      }
      user.password = dto.newPassword;
      user.updatedAt = Date.now();
      const { password, ...result } = user;
      return result;
    }

    Object.assign(user, dto);
    user.updatedAt = Date.now();

    const { password, ...result } = user;
    return result;
  }

  remove(id: string) {
    const index = this.db.users.findIndex((u) => u.id === id);
    if (index === -1) throw new NotFoundException();

    this.db.users.splice(index, 1);

    this.db.articles.forEach((art) => {
      if (art.authorId === id) art.authorId = null;
    });

    this.db.comments = this.db.comments.filter((c) => c.authorId !== id);
  }
}
