import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { getJwtAccessSecret } from '../jwt-secrets.util';
import { AuthUser } from '../types/auth-user.type';

@Injectable()
export class JwtRbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Authorization header is required');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    let payload: AuthUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: getJwtAccessSecret(),
      });
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    request.user = payload;
    return this.isAllowed(request);
  }

  private async isAllowed(request: any): Promise<boolean> {
    const user = request.user as AuthUser;
    const role = user.role?.toLowerCase();
    const method = String(request.method || '').toUpperCase();
    const basePath = this.getBasePath(request.path);
    const resourceId = request.params?.id as string | undefined;

    if (role === 'admin') {
      return true;
    }

    if (method === 'GET') {
      return true;
    }

    if (role === 'viewer') {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (role !== 'editor') {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (basePath === '/category') {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (basePath === '/user') {
      if (method !== 'PUT' || !resourceId || resourceId !== user.userId) {
        throw new ForbiddenException('Insufficient permissions');
      }
      if (request.body?.role !== undefined) {
        throw new ForbiddenException('Only admins can change user role');
      }
      return true;
    }

    if (basePath === '/article') {
      return this.allowEditorArticleAction(
        method,
        resourceId,
        request.body,
        user,
      );
    }

    if (basePath === '/comment') {
      return this.allowEditorCommentAction(
        method,
        resourceId,
        request.body,
        user,
      );
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  private async allowEditorArticleAction(
    method: string,
    articleId: string | undefined,
    body: Record<string, any>,
    user: AuthUser,
  ) {
    const requestBody = body ?? {};

    if (method === 'POST') {
      if (!requestBody.authorId) {
        requestBody.authorId = user.userId;
      }
      if (requestBody.authorId !== user.userId) {
        throw new ForbiddenException(
          'Editors can only create their own articles',
        );
      }
      return true;
    }

    if (method === 'PUT') {
      if (!articleId) {
        throw new ForbiddenException('Insufficient permissions');
      }

      const article = await this.prisma.article.findUnique({
        where: { id: articleId },
        select: { authorId: true },
      });

      if (!article) {
        return true;
      }

      if (article.authorId !== user.userId) {
        throw new ForbiddenException(
          'Editors can only update their own articles',
        );
      }

      if (requestBody.authorId && requestBody.authorId !== user.userId) {
        throw new ForbiddenException('Editors cannot reassign article owner');
      }

      return true;
    }

    if (method === 'DELETE') {
      if (!articleId) {
        throw new ForbiddenException('Insufficient permissions');
      }

      const article = await this.prisma.article.findUnique({
        where: { id: articleId },
        select: { authorId: true },
      });

      if (!article) {
        return true;
      }

      if (article.authorId !== user.userId) {
        throw new ForbiddenException(
          'Editors cannot delete other users articles',
        );
      }

      return true;
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  private async allowEditorCommentAction(
    method: string,
    commentId: string | undefined,
    body: Record<string, any>,
    user: AuthUser,
  ) {
    const requestBody = body ?? {};

    if (method === 'POST') {
      if (!requestBody.authorId) {
        requestBody.authorId = user.userId;
      }
      if (requestBody.authorId !== user.userId) {
        throw new ForbiddenException(
          'Editors can only create their own comments',
        );
      }
      return true;
    }

    if (method === 'PUT' || method === 'DELETE') {
      if (!commentId) {
        throw new ForbiddenException('Insufficient permissions');
      }

      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
        select: { authorId: true },
      });

      if (!comment) {
        return true;
      }

      if (comment.authorId !== user.userId) {
        throw new ForbiddenException(
          method === 'PUT'
            ? 'Editors can only update their own comments'
            : 'Editors cannot delete other users comments',
        );
      }

      if (
        method === 'PUT' &&
        requestBody.authorId &&
        requestBody.authorId !== user.userId
      ) {
        throw new ForbiddenException('Editors cannot reassign comment owner');
      }

      return true;
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  private getBasePath(path: string): string {
    const [firstSegment] = String(path || '/')
      .split('?')[0]
      .split('/')
      .filter(Boolean);
    return firstSegment ? `/${firstSegment}` : '/';
  }
}
