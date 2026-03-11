import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: Number(user.id),
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: Number(user.id),
        email: user.email,
        name: user.name,
        role: user.role.name,
        permissions: user.role.permissions,
      },
    };
  }

  async loginWithMicrosoft(msAccessToken: string) {
    // Call Microsoft Graph API to get user info
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${msAccessToken}` },
    });

    if (!graphResponse.ok) {
      throw new UnauthorizedException('Invalid Microsoft access token');
    }

    const msUser = await graphResponse.json();
    const email = (msUser.mail || msUser.userPrincipalName || '').toLowerCase();
    const displayName = msUser.displayName || email.split('@')[0];

    if (!email) {
      throw new UnauthorizedException('Could not retrieve email from Microsoft account');
    }

    // Find existing user
    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    // Auto-create user if not found — assign least-privileged role, inactive by default
    if (!user) {
      const defaultRole = await this.prisma.role.findFirst({
        where: { name: 'VIEWER' },
      });

      if (!defaultRole) {
        throw new UnauthorizedException('No default VIEWER role configured in the system');
      }

      const randomPassword = randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      user = await this.prisma.user.create({
        data: {
          email,
          name: displayName,
          password_hash: passwordHash,
          role_id: defaultRole.id,
          is_active: false, // Admin must activate new Microsoft users
        },
        include: { role: true },
      });

      throw new UnauthorizedException('Account created but pending admin activation');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const payload = {
      sub: Number(user.id),
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: Number(user.id),
        email: user.email,
        name: user.name,
        role: user.role.name,
        permissions: user.role.permissions,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(decoded.sub) },
        include: { role: true },
      });

      if (!user || !user.is_active) {
        throw new UnauthorizedException('User account is deactivated or does not exist');
      }

      // Use fresh role/permissions from DB (not stale JWT claims)
      const payload = {
        sub: Number(user.id),
        email: user.email,
        role: user.role.name,
        permissions: user.role.permissions,
      };

      return {
        accessToken: this.jwtService.sign(payload),
        refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      include: { role: true },
    });

    if (!user) throw new UnauthorizedException('User not found');

    return {
      id: Number(user.id),
      email: user.email,
      name: user.name,
      role: user.role.name,
      permissions: user.role.permissions,
    };
  }
}
