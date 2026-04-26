import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { plainToInstance } from 'class-transformer';

@ApiTags('article')
@Controller('article')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new article' })
  @ApiResponse({ status: 201, description: 'Article created successfully' })
  async create(@Body() createArticleDto: CreateArticleDto) {
    const article = await this.articleService.create(createArticleDto);
    return plainToInstance(CreateArticleDto, article);
  }

  @Get()
  @ApiOperation({ summary: 'Get all articles with optional filtering' })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by status (e.g., draft, published)',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'tag',
    required: false,
    type: String,
    description: 'Filter by a specific tag',
  })
  async findAll(
    @Query() query: { status?: Status; categoryId?: string; tag?: string },
  ) {
    const articles = await this.articleService.findAll(query);
    return plainToInstance(CreateArticleDto, articles);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific article by ID' })
  async findOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ) {
    const article = await this.articleService.findOne(id);
    return plainToInstance(CreateArticleDto, article);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an article' })
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() updateArticleDto: UpdateArticleDto,
  ) {
    const article = await this.articleService.update(id, updateArticleDto);
    return plainToInstance(UpdateArticleDto, article);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an article' })
  @ApiResponse({ status: 204, description: 'Article successfully deleted' })
  remove(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ) {
    return this.articleService.remove(id);
  }
}
