import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existingUser = await this.findByLogin(dto.login);
    if (existingUser) {
      throw new BadRequestException('Login is already taken');
    }

    const hashedPassword = await this.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        login: dto.login,
        password: hashedPassword,
        role: dto.role || 'VIEWER',
      },
    });

    return this.removePassword(user);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: {
        _count: {
          select: { articles: true, comments: true },
        },
      },
    });

    return users.map((user) => this.removePassword(user));
  }

  async findOne(id: string) {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.removePassword(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const data: { password?: string; role?: UpdateUserDto['role'] } = {};

    if (dto.oldPassword || dto.newPassword) {
      if (!dto.oldPassword || !dto.newPassword) {
        throw new BadRequestException(
          'Both oldPassword and newPassword are required',
        );
      }
      const passwordMatches = await bcrypt.compare(
        dto.oldPassword,
        user.password,
      );
      if (!passwordMatches) {
        throw new ForbiddenException('Old password is wrong');
      }
      data.password = await this.hashPassword(dto.newPassword);
    }

    if (dto.role) {
      data.role = dto.role;
    }

    if (!Object.keys(data).length) {
      throw new BadRequestException('No valid fields to update');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.removePassword(updatedUser);
  }

  async remove(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.article.updateMany({
        where: { authorId: id },
        data: { status: 'ARCHIVED' },
      });
      await tx.user.delete({ where: { id } });
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByLogin(login: string) {
    return this.prisma.user.findFirst({
      where: { login },
    });
  }

  private async hashPassword(password: string) {
    const saltRounds = Number(process.env.CRYPT_SALT || 10);
    return bcrypt.hash(password, saltRounds);
  }

  private removePassword<T extends { password?: string }>(
    user: T,
  ): Omit<T, 'password'> {
    const safeUser = { ...user };
    delete safeUser.password;
    return safeUser;
  }
}
