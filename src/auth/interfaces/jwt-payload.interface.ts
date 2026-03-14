export interface JwtAccessPayload {
  sub: string;
  phone: string;
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  phone: string;
  type: 'refresh';
  jti: string;
}

export type JwtPayload = JwtAccessPayload | JwtRefreshPayload;
