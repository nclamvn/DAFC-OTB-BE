import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController, TicketPublicController } from './ticket.controller';

@Module({
  controllers: [TicketPublicController, TicketController],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}
