import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

/**
 * Swagger decorator cho response single item:
 * { success: true, statusCode: 200, data: T }
 */
export function ApiStandardResponse(model: Type<unknown>) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: 200,
      description: 'Success',
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: 200 },
          data: { $ref: getSchemaPath(model) },
        },
      },
    }),
  );
}

/**
 * Swagger decorator cho response paginated:
 * { success: true, statusCode: 200, data: T[], meta: { page, pageSize, total, totalPages } }
 */
export function ApiPaginatedResponse(model: Type<unknown>) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: 200,
      description: 'Paginated list',
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: 200 },
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'number', example: 1 },
              pageSize: { type: 'number', example: 20 },
              total: { type: 'number', example: 100 },
              totalPages: { type: 'number', example: 5 },
            },
          },
        },
      },
    }),
  );
}

/**
 * Swagger decorator cho response message (delete, action):
 * { success: true, statusCode: 200, message: string }
 */
export function ApiMessageResponse(message = 'Operation completed') {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description: 'Message response',
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: 200 },
          message: { type: 'string', example: message },
        },
      },
    }),
  );
}

/**
 * Generic success response — không cần model class:
 * { success: true, statusCode: 200, data: object }
 */
export function ApiSuccessResponse(description = 'Success') {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: 200 },
          data: { type: 'object' },
        },
      },
    }),
  );
}

/**
 * Generic paginated response — không cần model class:
 * { success: true, statusCode: 200, data: object[], meta: { page, pageSize, total, totalPages } }
 */
export function ApiGenericPaginatedResponse(description = 'Paginated list') {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: 200 },
          data: { type: 'array', items: { type: 'object' } },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'number', example: 1 },
              pageSize: { type: 'number', example: 20 },
              total: { type: 'number', example: 100 },
              totalPages: { type: 'number', example: 5 },
            },
          },
        },
      },
    }),
  );
}

/**
 * Swagger decorator cho các error responses thông dụng
 */
export function ApiErrorResponses() {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description: 'Bad Request',
      schema: {
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'number', example: 400 },
          message: { type: 'string', example: 'Validation failed' },
          timestamp: { type: 'string', example: '2026-03-02T10:00:00.000Z' },
          path: { type: 'string', example: '/api/v1/budgets' },
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
    ApiResponse({ status: 404, description: 'Not Found' }),
  );
}
