import { Injectable } from '@nestjs/common';
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
    const {password, ...result} = newUser;
    return result;
  }

  findAll() {
    return `This action returns all user`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
