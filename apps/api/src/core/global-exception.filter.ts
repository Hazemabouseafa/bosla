import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const isZodErr =
      exception instanceof ZodError ||
      (typeof exception === 'object' &&
        exception !== null &&
        (exception as any).name === 'ZodError' &&
        Array.isArray((exception as any).issues));

    if (isZodErr) {
      const issues: Array<{ path: Array<string | number>; message: string }> =
        (exception as any).issues ?? (exception as ZodError).errors ?? [];
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: issues[0]?.message || 'بيانات الإدخال غير صالحة',
        errors: issues.map((e) => ({
          path: Array.isArray(e.path) ? e.path.join('.') : '',
          message: e.message,
        })),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(
        typeof body === 'string'
          ? { statusCode: status, message: body }
          : body,
      );
      return;
    }

    console.error('Unhandled API error:', exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'حدث خطأ غير متوقع في الخادم',
    });
  }
}
