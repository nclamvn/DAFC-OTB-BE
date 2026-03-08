import { Controller, Get, Post, Put, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { ReceiptService } from './receipt.service';
import { SaveReceiptDto, UpdateReceiptDto } from './dto/receipt.dto';
import { PERMISSIONS } from '../../common/constants/permissions';
import { ApiErrorResponses, ApiSuccessResponse } from '../../common/decorators/api-response.decorator';

@ApiTags('receipts')
@ApiBearerAuth()
@ApiErrorResponses()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('receipts')
export class ReceiptController {
  constructor(private receiptService: ReceiptService) {}

  @Get('ticket/:ticketId')
  @RequirePermissions(PERMISSIONS.ORDER.READ)
  @ApiOperation({ summary: 'Get order + receipt data by ticket ID' })
  @ApiSuccessResponse()
  async findByTicketId(@Param('ticketId') ticketId: string) {
    return this.receiptService.findByTicketId(ticketId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORDER.WRITE)
  @ApiOperation({ summary: 'Save receipt rows for a ticket (upsert)' })
  @ApiSuccessResponse('Receipt saved')
  async save(@Body() body: SaveReceiptDto, @Request() req: any) {
    return this.receiptService.save(body, BigInt(req.user.sub));
  }

  @Put('ticket/:ticketId')
  @RequirePermissions(PERMISSIONS.ORDER.WRITE)
  @ApiOperation({ summary: 'Update specific receipt rows' })
  @ApiSuccessResponse()
  async updateRows(
    @Param('ticketId') ticketId: string,
    @Body() body: UpdateReceiptDto,
    @Request() req: any,
  ) {
    return this.receiptService.updateRows(ticketId, body, BigInt(req.user.sub));
  }

  @Patch('ticket/:ticketId/confirm')
  @RequirePermissions(PERMISSIONS.ORDER.WRITE)
  @ApiOperation({ summary: 'Confirm receipt for a ticket' })
  @ApiSuccessResponse()
  async confirm(@Param('ticketId') ticketId: string, @Request() req: any) {
    return this.receiptService.confirm(ticketId, BigInt(req.user.sub));
  }
}
