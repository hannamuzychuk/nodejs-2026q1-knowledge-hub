import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const user = await this.prisma.user.create({
      data: {
        login: dto.login,
        password: dto.password,
        role: dto.role  || 'VIEWER',
      },
    });

    const {password, ...result } = user;
    return result;
  }

  async findAll() {
      const users = await this.prisma.user.findMany();
      return users.map(({ password, ...user }) => user);

  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user){
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...result } = user;
    return result;
  }

  async update(id: string, dto: UpdateUserDto) {
    if (!dto.newPassword || !dto.oldPassword) {
      throw new BadRequestException('Invalid DTO');
    }

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

      const { password, ...result } = updatedUser;
      return result;
    }
      throw new BadRequestException('Invalid DTO - password change required');
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.delete({ where: { id } });
  } 
}
