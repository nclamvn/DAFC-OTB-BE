import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from './jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { ApiErrorResponses, ApiSuccessResponse } from '../../common/decorators/api-response.decorator';

class LoginDto {
  @ApiProperty({ example: 'admin@dafc.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'dafc@2026' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

class MicrosoftLoginDto {
  @ApiProperty({ description: 'Microsoft access token from MSAL' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}

class RefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

@ApiTags('auth')
@ApiErrorResponses()
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiSuccessResponse('Login successful')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('microsoft')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Login with Microsoft (Azure AD)' })
  @ApiSuccessResponse('Microsoft login successful')
  async loginWithMicrosoft(@Body() dto: MicrosoftLoginDto) {
    return this.authService.loginWithMicrosoft(dto.accessToken);
  }

  @Post('refresh')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiSuccessResponse('Token refreshed')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiSuccessResponse('User profile')
  async getProfile(@Request() req: { user: JwtPayload }) {
    return this.authService.getProfile(String(req.user.sub));
  }
}
