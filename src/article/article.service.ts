import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Status } from '@prisma/client';

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateArticleDto) {
    return this.prisma.article.create({
      data: {
        title: dto.title,
        content: dto.content,
        status: dto.status || Status.DRAFT,
        author: { connect: { id: dto.authorId } },
        category: dto.categoryId
          ? { connect: { id: dto.categoryId } }
          : undefined,
        tags: {
          connectOrCreate: dto.tags?.map((tagName) => ({
            where: { name: tagName },
            create: { name: tagName },
          })),
        },
      },
      include: {
        tags: true,
        category: true,
        author: { select: { id: true, login: true } },
      },
    });
  }

  async findAll(query: { status?: Status; categoryId?: string; tag?: string }) {
    return this.prisma.article.findMany({
      where: {
        status: query.status,
        categoryId: query.categoryId,
        tags: query.tag ? { some: { name: query.tag } } : undefined,
      },
      include: {
        author: { select: { id: true, login: true, role: true } },
        category: true,
        tags: true,
        _count: { select: { comments: true } },
      },
    });
  }

  async findOne(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, login: true, role: true } },
        category: true,
        tags: true,
        comments: {
          include: {
            author: { select: { login: true } },
          },
        },
      },
    });
    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }
    return article;
  }

  async update(id: string, dto: UpdateArticleDto) {
    await this.findOne(id);
    return this.prisma.article.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        status: dto.status,
        authorId: dto.authorId,
        categoryId: dto.categoryId,
        tags: dto.tags
          ? {
              set: [],
              connectOrCreate: dto.tags?.map((tagName) => ({
                where: { name: tagName },
                create: { name: tagName },
              })),
            }
          : undefined,
      },
      include: {
        tags: true,
        category: true,
        author: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.article.delete({ where: { id } });
  }
}
