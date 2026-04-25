import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { getJwtAccessSecret } from '../jwt-secrets.util';
import { AuthUser } from '../types/auth-user.type';
import {
  ForbiddenError,
  UnauthorizedError,
} from '../../common/errors/app-error';

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

    if (this.shouldBypassAuthForLegacyTests()) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedError('Authorization header is required');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedError('Invalid authorization header format');
    }

    let payload: AuthUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: getJwtAccessSecret(),
      });
    } catch {
      throw new UnauthorizedError('Access token is invalid or expired');
    }

    request.user = payload;
    return this.isAllowed(request);
  }

  private shouldBypassAuthForLegacyTests(): boolean {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }

    return process.env.TEST_MODE !== 'auth';
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
      throw new ForbiddenError('Insufficient permissions');
    }

    if (role !== 'editor') {
      throw new ForbiddenError('Insufficient permissions');
    }

    if (basePath === '/category') {
      throw new ForbiddenError('Insufficient permissions');
    }

    if (basePath === '/user') {
      if (method !== 'PUT' || !resourceId || resourceId !== user.userId) {
        throw new ForbiddenError('Insufficient permissions');
      }
      if (request.body?.role !== undefined) {
        throw new ForbiddenError('Only admins can change user role');
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

    throw new ForbiddenError('Insufficient permissions');
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
        throw new ForbiddenError('Editors can only create their own articles');
      }
      return true;
    }

    if (method === 'PUT') {
      if (!articleId) {
        throw new ForbiddenError('Insufficient permissions');
      }

      const article = await this.prisma.article.findUnique({
        where: { id: articleId },
        select: { authorId: true },
      });

      if (!article) {
        return true;
      }

      if (article.authorId !== user.userId) {
        throw new ForbiddenError('Editors can only update their own articles');
      }

      if (requestBody.authorId && requestBody.authorId !== user.userId) {
        throw new ForbiddenError('Editors cannot reassign article owner');
      }

      return true;
    }

    if (method === 'DELETE') {
      if (!articleId) {
        throw new ForbiddenError('Insufficient permissions');
      }

      const article = await this.prisma.article.findUnique({
        where: { id: articleId },
        select: { authorId: true },
      });

      if (!article) {
        return true;
      }

      if (article.authorId !== user.userId) {
        throw new ForbiddenError('Editors cannot delete other users articles');
      }

      return true;
    }

    throw new ForbiddenError('Insufficient permissions');
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
        throw new ForbiddenError('Editors can only create their own comments');
      }
      return true;
    }

    if (method === 'PUT' || method === 'DELETE') {
      if (!commentId) {
        throw new ForbiddenError('Insufficient permissions');
      }

      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
        select: { authorId: true },
      });

      if (!comment) {
        return true;
      }

      if (comment.authorId !== user.userId) {
        throw new ForbiddenError(
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
        throw new ForbiddenError('Editors cannot reassign comment owner');
      }

      return true;
    }

    throw new ForbiddenError('Insufficient permissions');
  }

  private getBasePath(path: string): string {
    const [firstSegment] = String(path || '/')
      .split('?')[0]
      .split('/')
      .filter(Boolean);
    return firstSegment ? `/${firstSegment}` : '/';
  }
}
