import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  Query,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

@ApiTags('comment')
@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new comment' })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  @ApiResponse({ status: 422, description: 'Article does not exist' })
  async create(@Body() createCommentDto: CreateCommentDto) {
    const comment = await this.commentService.create(createCommentDto);
    return plainToInstance(CreateCommentDto, comment);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all comments (optionally filtered by Article ID)',
  })
  @ApiQuery({ name: 'articleId', required: false, type: String })
  async findAll(@Query('articleId') articleId?: string) {
    const comments = await this.commentService.findAll({ articleId });
    return plainToInstance(CreateCommentDto, comments);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific comment by ID' })
  async findOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ) {
    const comment = await this.commentService.findOne(id);
    return plainToInstance(CreateCommentDto, comment);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Get a specific comment by ID' })
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    const comment = await this.commentService.update(id, updateCommentDto);
    return plainToInstance(UpdateCommentDto, comment);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 204, description: 'Comment deleted successfully' })
  remove(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ) {
    return this.commentService.remove(id);
  }
}
