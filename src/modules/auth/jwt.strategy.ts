import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    // P0 SEC: Validate user still exists and is active in DB
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(payload.sub) },
      select: { id: true, is_active: true, role: { select: { name: true, permissions: true } } },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('User account is deactivated or does not exist');
    }

    // Return fresh role/permissions from DB (not stale JWT claims)
    return {
      sub: payload.sub,
      email: payload.email,
      role: user.role.name,
      permissions: user.role.permissions,
    };
  }
}
