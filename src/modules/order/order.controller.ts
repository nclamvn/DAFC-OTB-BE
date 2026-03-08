import { Controller, Get, Post, Put, Patch, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { OrderService } from './order.service';
import { SaveOrderDto, UpdateOrderDto } from './dto/order.dto';
import { PERMISSIONS } from '../../common/constants/permissions';
import { ApiErrorResponses, ApiSuccessResponse } from '../../common/decorators/api-response.decorator';

@ApiTags('orders')
@ApiBearerAuth()
@ApiErrorResponses()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORDER.READ)
  @ApiOperation({ summary: 'List tickets with confirmed orders' })
  @ApiQuery({ name: 'status', required: false, description: 'Order status filter (default: CONFIRMED)' })
  @ApiSuccessResponse()
  async findAll(@Query('status') status?: string) {
    return this.orderService.findAll({ status });
  }

  @Get('ticket/:ticketId')
  @RequirePermissions(PERMISSIONS.ORDER.READ)
  @ApiOperation({ summary: 'Get order rows by ticket ID' })
  @ApiSuccessResponse()
  async findByTicketId(@Param('ticketId') ticketId: string) {
    return this.orderService.findByTicketId(ticketId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORDER.WRITE)
  @ApiOperation({ summary: 'Save order rows for a ticket (replace all)' })
  @ApiSuccessResponse('Order saved')
  async save(@Body() body: SaveOrderDto, @Request() req: any) {
    return this.orderService.save(body, BigInt(req.user.sub));
  }

  @Put('ticket/:ticketId')
  @RequirePermissions(PERMISSIONS.ORDER.WRITE)
  @ApiOperation({ summary: 'Update specific order rows' })
  @ApiSuccessResponse()
  async updateRows(
    @Param('ticketId') ticketId: string,
    @Body() body: UpdateOrderDto,
    @Request() req: any,
  ) {
    return this.orderService.updateRows(ticketId, body, BigInt(req.user.sub));
  }

  @Patch('ticket/:ticketId/confirm')
  @RequirePermissions(PERMISSIONS.ORDER.WRITE)
  @ApiOperation({ summary: 'Confirm order for a ticket' })
  @ApiSuccessResponse()
  async confirm(@Param('ticketId') ticketId: string, @Request() req: any) {
    return this.orderService.confirm(ticketId, BigInt(req.user.sub));
  }

  @Patch('ticket/:ticketId/cancel')
  @RequirePermissions(PERMISSIONS.ORDER.WRITE)
  @ApiOperation({ summary: 'Cancel order for a ticket' })
  @ApiSuccessResponse()
  async cancel(@Param('ticketId') ticketId: string, @Request() req: any) {
    return this.orderService.cancel(ticketId, BigInt(req.user.sub));
  }
}
