import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const user = await this.prisma.user.create({
      data: {
        login: dto.login,
        password: dto.password,
        role: dto.role || 'VIEWER',
      },
    });

    delete (user as any).password;
    return user;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: {
        _count: {
          select: { articles: true, comments: true },
        },
      },
    });

    return users.map((user) => {
      const userResponse = { ...user };
      delete (userResponse as { password?: string }).password;
      return userResponse;
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    delete (user as any).password;
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) throw new NotFoundException('User not found');

    if (dto.oldPassword && dto.newPassword) {
      if (user.password !== dto.oldPassword) {
        throw new ForbiddenException('Old password is wrong');
      }
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          password: dto.newPassword,
        },
      });

      delete (updatedUser as any).password;
      return updatedUser;
    }
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    return await this.prisma.$transaction(async (tx) => {
      await tx.article.updateMany({
        where: { authorId: id },
        data: { status: 'ARCHIVED' },
      });
      return await tx.user.delete({ where: { id } });
    });
  }
}
