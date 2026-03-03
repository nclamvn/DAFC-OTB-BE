import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((value) => {
        const statusCode = response.statusCode;

        // null / undefined → empty success
        if (value === null || value === undefined) {
          return { success: true, statusCode };
        }

        // Nếu response đã có `data` hoặc `message` key (service trả về { data, meta } hoặc { message })
        // → spread vào wrapper, giữ nguyên cấu trúc
        if (
          typeof value === 'object' &&
          !Array.isArray(value) &&
          ('data' in (value as object) || 'message' in (value as object))
        ) {
          return { success: true, statusCode, ...(value as object) };
        }

        // Còn lại (plain object, array, primitive) → wrap trong data
        return { success: true, statusCode, data: value };
      }),
    );
  }
}
