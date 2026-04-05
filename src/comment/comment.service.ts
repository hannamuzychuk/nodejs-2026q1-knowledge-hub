import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { randomUUID } from 'crypto';
import { DbService } from 'src/db/db.service';

@Injectable()
export class CommentService {
  constructor(private readonly db: DbService) {}
  create(dto: CreateCommentDto) {
    const articleExists = this.db.articles.some((a) => a.id === dto.articleId);
    if (!articleExists) {
      throw new UnprocessableEntityException('Article does not exist');
    }

    const newComment = {
      id: randomUUID(),
      ...dto,
      createdAt: Date.now(),
    };
    this.db.comments.push(newComment);
    return newComment;
  }

  findAll(query: { articleId?: string }) {
    if (query.articleId) {
      return this.db.comments.filter((c) => c.articleId === query.articleId);
    }

    return this.db.comments;
  }

  findOne(id: string) {
    const comment = this.db.comments.find((c) => c.id === id);
    if (!comment) throw new NotFoundException('Comment not found');

    return comment;
  }

  update(id: string, dto: UpdateCommentDto) {
    const comment = this.findOne(id);
    Object.assign(comment, dto);

    return comment;
  }

  remove(id: string) {
    const index = this.db.comments.findIndex((c) => c.id === id);
    if (index === -1) throw new NotFoundException('Comment not found');
    this.db.comments.splice(index, 1);
  }
}
