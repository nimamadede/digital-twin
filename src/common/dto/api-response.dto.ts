/**
 * Unified API response shape.
 * Wrapped by TransformInterceptor.
 */
export interface ApiResponseDto<T = unknown> {
  data: T;
  code: number;
  message?: string;
}

export interface ApiErrorDto {
  data: null;
  code: number;
  message: string;
  error?: string;
}
