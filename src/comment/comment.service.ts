import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCommentDto) {
    const article = this.prisma.article.findUnique({
      where: {
        id: dto.articleId,
      },
    });
    if (!article) {
      throw new UnprocessableEntityException('Article does not exist');
    }

    const author = await this.prisma.user.findUnique({
      where: { id: dto.authorId },
    });
    if (!author) {
      throw new UnprocessableEntityException('Author does not exist');
    }
    return this.prisma.comment.create({
      data: {
        content: dto.content,
        articleId: dto.articleId,
        authorId: dto.authorId,
      },
    });
  }

  async findAll(query?: { articleId?: string }) {
    return this.prisma.comment.findMany({
      where: {
        articleId: query?.articleId,
      },
      include: {
        author: { select: { login: true } },
        article: { select: { title: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        author: { select: { login: true } },
        article: { select: { title: true } },
      },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }
    return comment;
  }

  async update(id: string, dto: UpdateCommentDto) {
    await this.findOne(id);
    return this.prisma.comment.update({
      where: { id },
      data: {
        content: dto.content,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.comment.delete({
      where: { id },
    });
  }
}
