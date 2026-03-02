import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

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
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto) {
    return {
      success: true,
      data: await this.authService.login(dto.email, dto.password),
    };
  }

  @Post('microsoft')
  @ApiOperation({ summary: 'Login with Microsoft (Azure AD)' })
  async loginWithMicrosoft(@Body() dto: MicrosoftLoginDto) {
    return {
      success: true,
      data: await this.authService.loginWithMicrosoft(dto.accessToken),
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshDto) {
    return {
      success: true,
      data: await this.authService.refresh(dto.refreshToken),
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req: any) {
    return {
      success: true,
      data: await this.authService.getProfile(req.user.sub),
    };
  }
}
