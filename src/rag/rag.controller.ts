import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  RagChatRequestDto,
  RagChatResponseDto,
  RagConversationHistoryResponseDto,
} from './dto/rag-chat.dto';
import {
  RagSearchRequestDto,
  RagSearchResponseDto,
  ReindexRequestDto,
  ReindexResponseDto,
} from './dto/rag-index.dto';
import {
  RagArticleIdParamDto,
  RagConversationIdParamDto,
} from './dto/rag-article-param.dto';
import { RagService } from './rag.service';

@ApiTags('ai-rag')
@Controller('ai/rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('index')
  @ApiOperation({ summary: 'Build or refresh vector index from articles' })
  @ApiBody({ type: ReindexRequestDto, required: false })
  @ApiResponse({ status: 200, type: ReindexResponseDto })
  indexKnowledgeBase(@Body() body: ReindexRequestDto) {
    return this.ragService.reindex(body || {});
  }

  @Post('search')
  @ApiOperation({ summary: 'Semantic search in indexed Knowledge Hub content' })
  @ApiBody({ type: RagSearchRequestDto })
  @ApiResponse({ status: 200, type: RagSearchResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid search request' })
  search(@Body() body: RagSearchRequestDto) {
    return this.ragService.search(body);
  }

  @Post('chat')
  @ApiOperation({
    summary: 'Ask question grounded in indexed Knowledge Hub data',
  })
  @ApiBody({ type: RagChatRequestDto })
  @ApiResponse({ status: 200, type: RagChatResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid chat request' })
  chat(@Body() body: RagChatRequestDto) {
    return this.ragService.chat(body);
  }

  @Delete('index/articles/:articleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one article vectors from index' })
  @ApiParam({ name: 'articleId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Vectors removed' })
  @ApiResponse({ status: 404, description: 'Article/index entries not found' })
  async removeFromIndex(@Param() params: RagArticleIdParamDto) {
    await this.ragService.deleteArticleFromIndex(params.articleId);
  }

  @Get('chat/:conversationId/history')
  @ApiOperation({ summary: 'Get RAG chat conversation history (optional)' })
  @ApiParam({ name: 'conversationId', format: 'uuid' })
  @ApiResponse({ status: 200, type: RagConversationHistoryResponseDto })
  getConversationHistory(@Param() params: RagConversationIdParamDto) {
    return this.ragService.getConversationHistory(params.conversationId);
  }
}
