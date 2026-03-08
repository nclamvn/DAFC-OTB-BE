import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveReceiptDto, UpdateReceiptDto } from './dto/receipt.dto';

const toBigInt = (v: string | number) => BigInt(v);

function serializeBigInt(data: any): any {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );
}

@Injectable()
export class ReceiptService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // GET receipt rows by ticket ID (joined with order data)
  // ═══════════════════════════════════════════════════════════════════════════════

  async findByTicketId(ticketId: string) {
    const tid = toBigInt(ticketId);

    // Get all order rows for this ticket
    const orderRows = await this.prisma.orderConfirmation.findMany({
      where: { ticket_id: tid, status: 'CONFIRMED' },
      orderBy: { id: 'asc' },
    });

    if (orderRows.length === 0) return [];

    // Get existing receipt rows for this ticket
    const receiptRows = await this.prisma.receiptConfirmation.findMany({
      where: { ticket_id: tid },
    });

    // Build a map: order_confirmation_id → receipt row
    const receiptMap = new Map(
      receiptRows.map(r => [r.order_confirmation_id.toString(), r]),
    );

    // Get unit_cost from product master for each SKU
    const skus = [...new Set(orderRows.map(o => o.sku).filter(Boolean))];
    const products = skus.length > 0
      ? await this.prisma.product.findMany({
          where: { sku_code: { in: skus } },
          select: { sku_code: true, unit_cost: true },
        })
      : [];
    const costMap = new Map(products.map(p => [p.sku_code, Number(p.unit_cost)]));

    // Merge: each order row + its receipt data (if exists) + unit_cost
    const merged = orderRows.map(order => {
      const receipt = receiptMap.get(order.id.toString());
      return {
        ...order,
        // Unit cost from product master
        unit_cost: costMap.get(order.sku) ?? null,
        // Receipt fields (null if not yet filled)
        receipt_id: receipt?.id || null,
        received_units: receipt?.received_units ?? null,
        actual_unit_price: receipt?.actual_unit_price ?? null,
        actual_total_price: receipt?.actual_total_price ?? null,
        receipt_currency: receipt?.receipt_currency ?? null,
        receipt_comment: receipt?.receipt_comment ?? null,
        receipt_status: receipt?.status ?? null,
      };
    });

    return serializeBigInt(merged);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SAVE — upsert receipt rows for a ticket
  // ═══════════════════════════════════════════════════════════════════════════════

  async save(dto: SaveReceiptDto, userId: bigint) {
    const ticketId = toBigInt(dto.ticketId);

    // Verify ticket exists
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const result = await this.prisma.$transaction(async (tx) => {
      for (const row of dto.rows) {
        const orderConfId = toBigInt(row.order_confirmation_id);

        // Verify order row belongs to this ticket
        const orderRow = await tx.orderConfirmation.findFirst({
          where: { id: orderConfId, ticket_id: ticketId },
        });
        if (!orderRow) continue;

        // Upsert: find existing receipt row or create new
        const existing = await tx.receiptConfirmation.findFirst({
          where: { order_confirmation_id: orderConfId, ticket_id: ticketId },
        });

        const data = {
          received_units: row.received_units ?? 0,
          actual_unit_price: row.actual_unit_price ?? null,
          actual_total_price: row.actual_total_price ?? null,
          receipt_currency: row.receipt_currency || null,
          receipt_comment: row.receipt_comment || null,
          updated_by: userId,
        };

        if (existing) {
          await tx.receiptConfirmation.update({
            where: { id: existing.id },
            data,
          });
        } else {
          await tx.receiptConfirmation.create({
            data: {
              order_confirmation_id: orderConfId,
              ticket_id: ticketId,
              ...data,
              status: 'DRAFT',
              created_by: userId,
            },
          });
        }
      }

      // Return merged data
      return this.getMergedData(tx, ticketId);
    });

    return serializeBigInt(result);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UPDATE — partial update specific receipt rows
  // ═══════════════════════════════════════════════════════════════════════════════

  async updateRows(ticketId: string, dto: UpdateReceiptDto, userId: bigint) {
    const tid = toBigInt(ticketId);

    const result = await this.prisma.$transaction(async (tx) => {
      for (const row of dto.rows) {
        const orderConfId = toBigInt(row.order_confirmation_id);

        // Verify order row belongs to this ticket
        const orderRow = await tx.orderConfirmation.findFirst({
          where: { id: orderConfId, ticket_id: tid },
        });
        if (!orderRow) continue;

        const existing = await tx.receiptConfirmation.findFirst({
          where: { order_confirmation_id: orderConfId, ticket_id: tid },
        });

        const data: any = { updated_by: userId };
        const editableFields = [
          'received_units', 'actual_unit_price', 'actual_total_price',
          'receipt_currency', 'receipt_comment',
        ];
        for (const field of editableFields) {
          if (row[field] !== undefined) {
            data[field] = row[field];
          }
        }

        if (existing) {
          await tx.receiptConfirmation.update({
            where: { id: existing.id },
            data,
          });
        } else {
          await tx.receiptConfirmation.create({
            data: {
              order_confirmation_id: orderConfId,
              ticket_id: tid,
              ...data,
              status: 'DRAFT',
              created_by: userId,
            },
          });
        }
      }

      return this.getMergedData(tx, tid);
    });

    return serializeBigInt(result);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONFIRM — mark all receipt rows as CONFIRMED
  // ═══════════════════════════════════════════════════════════════════════════════

  async confirm(ticketId: string, userId: bigint) {
    const tid = toBigInt(ticketId);

    const count = await this.prisma.receiptConfirmation.count({
      where: { ticket_id: tid },
    });
    if (count === 0) throw new BadRequestException('No receipt rows to confirm. Please save data first.');

    await this.prisma.receiptConfirmation.updateMany({
      where: { ticket_id: tid, status: 'DRAFT' },
      data: { status: 'CONFIRMED', updated_by: userId },
    });

    return { message: 'Receipt confirmed', count };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPER — get merged order + receipt data
  // ═══════════════════════════════════════════════════════════════════════════════

  private async getMergedData(tx: any, ticketId: bigint) {
    const orderRows = await tx.orderConfirmation.findMany({
      where: { ticket_id: ticketId, status: 'CONFIRMED' },
      orderBy: { id: 'asc' },
    });

    const receiptRows = await tx.receiptConfirmation.findMany({
      where: { ticket_id: ticketId },
    });

    const receiptMap = new Map<string, any>(
      receiptRows.map((r: any) => [r.order_confirmation_id.toString(), r]),
    );

    // Get unit_cost from product master
    const skus = [...new Set(orderRows.map((o: any) => o.sku).filter(Boolean))];
    const products = skus.length > 0
      ? await tx.product.findMany({
          where: { sku_code: { in: skus } },
          select: { sku_code: true, unit_cost: true },
        })
      : [];
    const costMap = new Map(products.map((p: any) => [p.sku_code, Number(p.unit_cost)]));

    return orderRows.map((order: any) => {
      const receipt: any = receiptMap.get(order.id.toString());
      return {
        ...order,
        unit_cost: costMap.get(order.sku) ?? null,
        receipt_id: receipt?.id || null,
        received_units: receipt?.received_units ?? null,
        actual_unit_price: receipt?.actual_unit_price ?? null,
        actual_total_price: receipt?.actual_total_price ?? null,
        receipt_currency: receipt?.receipt_currency ?? null,
        receipt_comment: receipt?.receipt_comment ?? null,
        receipt_status: receipt?.status ?? null,
      };
    });
  }
}
