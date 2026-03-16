import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtAccessPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
    });
  }

  validate(payload: { sub?: string; phone?: string; type?: string }): JwtAccessPayload {
    if (payload.type !== 'access' || !payload.sub || !payload.phone) {
      throw new UnauthorizedException('TOKEN_EXPIRED');
    }
    return {
      sub: payload.sub,
      phone: payload.phone,
      type: 'access',
    };
  }
}
