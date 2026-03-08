import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveOrderDto, UpdateOrderDto } from './dto/order.dto';

// ─── BigInt-safe JSON serializer ────────────────────────────────────────────────

const toBigInt = (v: string | number) => BigInt(v);

function serializeBigInt(data: any): any {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );
}

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // LIST — tickets with confirmed orders (for Receipt page)
  // ═══════════════════════════════════════════════════════════════════════════════

  async findAll(filters?: { status?: string }) {
    const orderStatus = filters?.status || 'CONFIRMED';

    // Find distinct ticket IDs that have order rows with the given status
    const orderRows = await this.prisma.orderConfirmation.findMany({
      where: { status: orderStatus },
      select: { ticket_id: true },
      distinct: ['ticket_id'],
    });

    if (orderRows.length === 0) return [];

    const ticketIds = orderRows.map(r => r.ticket_id);

    // Fetch tickets with budget, season info
    const tickets = await this.prisma.ticket.findMany({
      where: {
        id: { in: ticketIds },
        status: { in: ['LEVEL2_APPROVED', 'APPROVED', 'FINAL'] },
      },
      include: {
        budget: true,
        season_group: true,
        season: true,
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    // For each ticket, get order summary (row count, total units, total amount)
    const result = await Promise.all(
      tickets.map(async (ticket) => {
        const rows = await this.prisma.orderConfirmation.findMany({
          where: { ticket_id: ticket.id, status: orderStatus },
        });

        const totalUnits = rows.reduce((sum, r) => sum + (r.total_units || 0), 0);
        const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const skuCount = new Set(rows.map(r => r.sku)).size;

        return {
          ...ticket,
          orderStatus,
          orderRowCount: rows.length,
          orderSkuCount: skuCount,
          orderTotalUnits: totalUnits,
          orderTotalAmount: totalAmount,
        };
      }),
    );

    return serializeBigInt(result);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // GET orders by ticket ID
  // ═══════════════════════════════════════════════════════════════════════════════

  async findByTicketId(ticketId: string) {
    const rows = await this.prisma.orderConfirmation.findMany({
      where: { ticket_id: toBigInt(ticketId) },
      orderBy: { id: 'asc' },
    });
    return serializeBigInt(rows);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // GET single order row
  // ═══════════════════════════════════════════════════════════════════════════════

  async findOne(id: string) {
    const row = await this.prisma.orderConfirmation.findUnique({
      where: { id: toBigInt(id) },
    });
    if (!row) throw new NotFoundException('Order row not found');
    return serializeBigInt(row);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SAVE — upsert all rows for a ticket (delete old + insert new)
  // ═══════════════════════════════════════════════════════════════════════════════

  async save(dto: SaveOrderDto, userId: bigint) {
    const ticketId = toBigInt(dto.ticketId);

    // Verify ticket exists
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Transaction: delete existing rows + insert new ones
    const result = await this.prisma.$transaction(async (tx) => {
      // Delete existing rows for this ticket
      await tx.orderConfirmation.deleteMany({
        where: { ticket_id: ticketId },
      });

      // Insert all rows
      if (dto.rows.length > 0) {
        const data = dto.rows.map((row) => ({
          ticket_id: ticketId,
          image_url: row.image_url || null,
          sku: row.sku,
          name: row.name || null,
          collection_name: row.collection_name || null,
          color: row.color || null,
          division: row.division || null,
          product_type: row.product_type || null,
          department: row.department || null,
          carry_forward: row.carry_forward || null,
          composition: row.composition || null,
          theme: row.theme || null,
          style_name: row.style_name || null,
          total_units: row.total_units ?? 0,
          size: row.size || null,
          brand_id: row.brand_id || null,
          color_code: row.color_code || null,
          fsr: row.fsr || null,
          wholesale_sgd: row.wholesale_sgd ?? null,
          rrp_sgd: row.rrp_sgd ?? null,
          regional_rrp: row.regional_rrp ?? null,
          total_price_sgd: row.total_price_sgd ?? null,
          mod: row.mod || null,
          ves: row.ves || null,
          in_catalogue: row.in_catalogue || null,
          gruppo: row.gruppo || null,
          tipology: row.tipology || null,
          sku_type: row.sku_type || null,
          gca: row.gca || null,
          window: row.window || null,
          heel: row.heel || null,
          dimension: row.dimension || null,
          finish: row.finish || null,
          delivery: row.delivery || null,
          currency: row.currency || null,
          price_mod_single: row.price_mod_single ?? null,
          price_mod_single_retail: row.price_mod_single_retail ?? null,
          amount: row.amount ?? null,
          amount_retail: row.amount_retail ?? null,
          product_status: row.product_status || null,
          size2: row.size2 || null,
          status: 'DRAFT',
          created_by: userId,
          updated_by: userId,
        }));

        await tx.orderConfirmation.createMany({ data });
      }

      // Return saved rows
      const saved = await tx.orderConfirmation.findMany({
        where: { ticket_id: ticketId },
        orderBy: { id: 'asc' },
      });
      return saved;
    });

    return serializeBigInt(result);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UPDATE — partial update specific rows
  // ═══════════════════════════════════════════════════════════════════════════════

  async updateRows(ticketId: string, dto: UpdateOrderDto, userId: bigint) {
    const tid = toBigInt(ticketId);

    const results = await this.prisma.$transaction(async (tx) => {
      for (const row of dto.rows) {
        if (!row.id) continue;
        const rowId = toBigInt(row.id);

        // Verify row belongs to this ticket
        const existing = await tx.orderConfirmation.findFirst({
          where: { id: rowId, ticket_id: tid },
        });
        if (!existing) continue;

        const updateData: any = { updated_by: userId };

        // Only update provided fields
        const editableFields = [
          'brand_id', 'color_code', 'fsr', 'wholesale_sgd', 'rrp_sgd',
          'regional_rrp', 'total_price_sgd', 'mod', 'ves', 'in_catalogue',
          'gruppo', 'tipology', 'sku_type', 'gca', 'window', 'heel',
          'dimension', 'finish', 'delivery', 'currency', 'price_mod_single',
          'price_mod_single_retail', 'amount', 'amount_retail', 'product_status', 'size2',
        ];

        for (const field of editableFields) {
          if (row[field] !== undefined) {
            updateData[field] = row[field];
          }
        }

        await tx.orderConfirmation.update({
          where: { id: rowId },
          data: updateData,
        });
      }

      return tx.orderConfirmation.findMany({
        where: { ticket_id: tid },
        orderBy: { id: 'asc' },
      });
    });

    return serializeBigInt(results);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONFIRM — mark all rows as CONFIRMED
  // ═══════════════════════════════════════════════════════════════════════════════

  async confirm(ticketId: string, userId: bigint) {
    const tid = toBigInt(ticketId);

    const count = await this.prisma.orderConfirmation.count({
      where: { ticket_id: tid },
    });
    if (count === 0) throw new BadRequestException('No order rows to confirm. Please save data first.');

    await this.prisma.orderConfirmation.updateMany({
      where: { ticket_id: tid, status: 'DRAFT' },
      data: { status: 'CONFIRMED', updated_by: userId },
    });

    return { message: 'Order confirmed', count };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CANCEL — mark all rows as CANCELLED
  // ═══════════════════════════════════════════════════════════════════════════════

  async cancel(ticketId: string, userId: bigint) {
    const tid = toBigInt(ticketId);

    await this.prisma.orderConfirmation.updateMany({
      where: { ticket_id: tid },
      data: { status: 'CANCELLED', updated_by: userId },
    });

    return { message: 'Order cancelled' };
  }
}
