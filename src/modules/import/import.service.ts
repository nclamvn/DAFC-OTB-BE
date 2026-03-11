import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ImportTargetEnum,
  ImportMode,
  DuplicateHandling,
  ImportBatchDto,
} from './dto/import.dto';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async processBatch(dto: ImportBatchDto) {
    const {
      target,
      mode = ImportMode.UPSERT,
      duplicateHandling = DuplicateHandling.SKIP,
      matchKey = [],
      rows,
      batchIndex = 0,
      totalBatches = 1,
    } = dto;

    const sessionIdStr = dto.sessionId || `import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Ensure an ImportSession exists for this batch
    let session = await this.prisma.importSession.findFirst({
      where: { target, file_name: sessionIdStr },
    });
    if (!session) {
      session = await this.prisma.importSession.create({
        data: {
          target,
          file_name: sessionIdStr,
          status: 'PROCESSING',
          total_rows: rows.length,
        },
      });
    }
    const sessionId = session.id;

    const result = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [] as Array<{ row: number; field?: string; error: string }>,
      sessionId: sessionIdStr,
      message: '',
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const hasData = Object.values(row).some((v) => v !== null && v !== undefined && v !== '');
        if (!hasData) {
          result.skipped++;
          continue;
        }

        const matchKeyValue = matchKey.length > 0
          ? matchKey.map((k) => String(row[k] || '')).join('||')
          : null;

        // Look for existing record in same session's target with matching data key
        const existingRecord = matchKeyValue
          ? await this.prisma.importedRecord.findFirst({
              where: {
                session: { target },
                data: { contains: matchKeyValue },
              },
            })
          : null;

        if (existingRecord) {
          if (mode === ImportMode.INSERT) {
            switch (duplicateHandling) {
              case DuplicateHandling.SKIP:
                result.skipped++;
                continue;
              case DuplicateHandling.OVERWRITE:
              case DuplicateHandling.MERGE: {
                const mergedData = duplicateHandling === DuplicateHandling.MERGE
                  ? { ...(JSON.parse(existingRecord.data) as Record<string, unknown>), ...row }
                  : row;
                await this.prisma.importedRecord.update({
                  where: { id: existingRecord.id },
                  data: {
                    data: JSON.stringify(mergedData),
                    session_id: sessionId,
                  },
                });
                result.updated++;
                continue;
              }
            }
          } else if (mode === ImportMode.UPSERT || mode === ImportMode.UPDATE_ONLY) {
            await this.prisma.importedRecord.update({
              where: { id: existingRecord.id },
              data: { data: JSON.stringify(row), session_id: sessionId },
            });
            result.updated++;
            continue;
          }
        } else {
          if (mode === ImportMode.UPDATE_ONLY) {
            result.skipped++;
            continue;
          }

          await this.prisma.importedRecord.create({
            data: {
              session_id: sessionId,
              row_number: i + 1,
              data: JSON.stringify(row),
              status: 'SUCCESS',
            },
          });
          result.inserted++;
        }
      } catch (err) {
        result.errors++;
        result.errorDetails.push({
          row: i + 1,
          error: err instanceof Error ? err.message : String(err),
        });
        this.logger.error(`Import error at row ${i + 1}:`, err);
      }
    }

    // Update session totals
    await this.prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        total_rows: rows.length,
        success_rows: result.inserted + result.updated,
        error_rows: result.errors,
        error_log: result.errorDetails.length > 0 ? JSON.stringify(result.errorDetails) : null,
      },
    });

    result.message = `Batch ${batchIndex + 1}/${totalBatches}: +${result.inserted} inserted, ↻${result.updated} updated, ⊘${result.skipped} skipped, ✕${result.errors} errors`;
    this.logger.log(`Import batch completed: ${result.message}`);
    return result;
  }

  async queryData(query: {
    target: ImportTargetEnum;
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { target, page = 1, pageSize = 50, search, sortOrder = 'desc' } = query;

    const where: any = { session: { target } };
    if (search) {
      where.data = { contains: search };
    }

    const total = await this.prisma.importedRecord.count({ where });

    const orderBy: any = { created_at: sortOrder };

    const records = await this.prisma.importedRecord.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const transformedRecords = records.map((r) => ({
      _id: String(r.id),
      _importedAt: r.created_at.toISOString(),
      _sessionId: String(r.session_id),
      ...(JSON.parse(r.data) as object),
    }));

    return {
      records: transformedRecords,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getStats(target: ImportTargetEnum) {
    const totalRecords = await this.prisma.importedRecord.count({
      where: { session: { target } },
    });

    const lastRecord = await this.prisma.importedRecord.findFirst({
      where: { session: { target } },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });

    const sessions = await this.prisma.importedRecord.groupBy({
      by: ['session_id'],
      where: { session: { target } },
    });

    const sampleRecords = await this.prisma.importedRecord.findMany({
      where: { session: { target } },
      take: 100,
      select: { data: true },
    });

    const fieldCounts: Record<string, number> = {};
    for (const record of sampleRecords) {
      const data = JSON.parse(record.data) as Record<string, unknown>;
      for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined && value !== '') {
          fieldCounts[key] = (fieldCounts[key] || 0) + 1;
        }
      }
    }

    return {
      target,
      totalRecords,
      lastImportAt: lastRecord?.created_at?.toISOString() || null,
      sessionCount: sessions.length,
      fieldCounts,
    };
  }

  async deleteSession(target: ImportTargetEnum, sessionId: string) {
    // Find the session by target and file_name (sessionId string)
    const session = await this.prisma.importSession.findFirst({
      where: { target, file_name: sessionId },
    });
    if (!session) return 0;

    const result = await this.prisma.importedRecord.deleteMany({
      where: { session_id: session.id },
    });
    this.logger.log(`Deleted ${result.count} records from session ${sessionId}`);
    return result.count;
  }

  async clearAll(target: ImportTargetEnum) {
    // Delete all records belonging to sessions with this target
    const sessions = await this.prisma.importSession.findMany({
      where: { target },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);

    const result = await this.prisma.importedRecord.deleteMany({
      where: { session_id: { in: sessionIds } },
    });
    this.logger.log(`Cleared all ${result.count} records for target ${target}`);
    return result.count;
  }

  // --- BIZ-05: ETL APPLY --- Transform imported_records into transactional tables --

  async applyImportedData(target: ImportTargetEnum, sessionId?: string) {
    const where: any = { session: { target } };
    if (sessionId) {
      const session = await this.prisma.importSession.findFirst({
        where: { target, file_name: sessionId },
      });
      if (session) {
        where.session_id = session.id;
        delete where.session;
      }
    }

    const records = await this.prisma.importedRecord.findMany({ where });
    if (records.length === 0) {
      return { applied: 0, skipped: 0, errors: 0, errorDetails: [], message: 'No records to apply' };
    }

    const result = { applied: 0, skipped: 0, errors: 0, errorDetails: [] as Array<{ id: string; error: string }> };

    switch (target) {
      case ImportTargetEnum.PRODUCTS:
        for (const record of records) {
          try {
            const data = JSON.parse(record.data) as Record<string, any>;
            const skuCode = data.skuCode || data.sku_code || data.SKU || data.sku;
            if (!skuCode) { result.skipped++; continue; }

            const productName = data.productName || data.product_name || data.name || data.NAME || skuCode;
            const srp = Number(data.srp || data.SRP || data.price || data.retail_price || 0);

            // Product requires sub_category_id; use a default or look up
            const subCategoryId = data.subCategoryId || data.sub_category_id || 1;

            await this.prisma.product.upsert({
              where: { id: BigInt(record.id) },
              update: {
                product_name: productName,
                theme: data.theme || data.THEME || undefined,
                color: data.color || data.COLOR || undefined,
                composition: data.composition || data.COMPOSITION || undefined,
                unit_price: srp > 0 ? srp : undefined,
                image_url: data.imageUrl || data.image_url || undefined,
              },
              create: {
                item_code: String(skuCode),
                sku_code: String(skuCode),
                product_name: productName,
                sub_category_id: BigInt(subCategoryId),
                theme: data.theme || data.THEME || null,
                color: data.color || data.COLOR || null,
                composition: data.composition || data.COMPOSITION || null,
                unit_price: srp > 0 ? srp : 0,
                unit_cost: 0,
                image_url: data.imageUrl || data.image_url || null,
              },
            });
            result.applied++;
          } catch (err) {
            result.errors++;
            result.errorDetails.push({ id: String(record.id), error: err instanceof Error ? err.message : String(err) });
          }
        }
        break;

      default:
        return { applied: 0, skipped: 0, errors: 0, errorDetails: [], message: `ETL apply not yet implemented for target: ${target}` };
    }

    const msg = `Applied ${result.applied} records, skipped ${result.skipped}, errors ${result.errors}`;
    this.logger.log(`ETL apply [${target}]: ${msg}`);
    return { ...result, message: msg };
  }

  // --- BIZ-14: WSSI SELL-THROUGH ANALYTICS ---

  async getWssiAnalytics() {
    const records = await this.prisma.importedRecord.findMany({
      where: { session: { target: 'wssi' } },
    });

    if (records.length === 0) {
      return {
        totalRecords: 0,
        totalReceivedQty: 0,
        totalSoldQty: 0,
        sellThroughRate: 0,
        byCategory: [],
        computedAt: new Date().toISOString(),
      };
    }

    // Accumulate totals and group by category/subcategory
    let totalReceivedQty = 0;
    let totalSoldQty = 0;

    const categoryMap = new Map<
      string,
      { category: string; subcategory: string; receivedQty: number; soldQty: number; recordCount: number }
    >();

    for (const record of records) {
      const data = JSON.parse(record.data) as Record<string, any>;

      // Extract received qty -- handle multiple possible field names
      const received = Number(
        data.received_qty ?? data.receivedQty ?? data.received ?? data.RECEIVED_QTY ?? data.ReceivedQty ?? 0,
      );

      // Extract sold qty -- handle multiple possible field names
      const sold = Number(
        data.sold_qty ?? data.soldQty ?? data.sold ?? data.SOLD_QTY ?? data.SoldQty ?? 0,
      );

      // Skip rows with no useful numeric data
      if (isNaN(received) && isNaN(sold)) continue;

      const safeReceived = isNaN(received) ? 0 : received;
      const safeSold = isNaN(sold) ? 0 : sold;

      totalReceivedQty += safeReceived;
      totalSoldQty += safeSold;

      // Group by category and subcategory
      const category = String(
        data.category ?? data.Category ?? data.CATEGORY ?? data.product_category ?? 'Uncategorized',
      );
      const subcategory = String(
        data.subcategory ?? data.subCategory ?? data.sub_category ?? data.SubCategory ?? data.SUB_CATEGORY ?? '',
      );

      const groupKey = `${category}||${subcategory}`;

      const existing = categoryMap.get(groupKey);
      if (existing) {
        existing.receivedQty += safeReceived;
        existing.soldQty += safeSold;
        existing.recordCount += 1;
      } else {
        categoryMap.set(groupKey, {
          category,
          subcategory: subcategory || 'N/A',
          receivedQty: safeReceived,
          soldQty: safeSold,
          recordCount: 1,
        });
      }
    }

    // Compute sell-through rate per category group
    const byCategory = Array.from(categoryMap.values()).map((group) => ({
      category: group.category,
      subcategory: group.subcategory,
      receivedQty: group.receivedQty,
      soldQty: group.soldQty,
      sellThroughRate:
        group.receivedQty > 0
          ? Math.round((group.soldQty / group.receivedQty) * 10000) / 100
          : 0,
      recordCount: group.recordCount,
    }));

    // Sort by sell-through rate descending
    byCategory.sort((a, b) => b.sellThroughRate - a.sellThroughRate);

    const overallSellThroughRate =
      totalReceivedQty > 0
        ? Math.round((totalSoldQty / totalReceivedQty) * 10000) / 100
        : 0;

    return {
      totalRecords: records.length,
      totalReceivedQty,
      totalSoldQty,
      sellThroughRate: overallSellThroughRate,
      byCategory,
      computedAt: new Date().toISOString(),
    };
  }

  async getAllTargetStats() {
    const targets = Object.values(ImportTargetEnum);
    const stats: Array<{ target: string; totalRecords: number; lastImportAt: string | null; sessionCount: number; fieldCounts: Record<string, number> }> = [];

    for (const target of targets) {
      const count = await this.prisma.importedRecord.count({ where: { session: { target } } });
      if (count > 0) {
        stats.push(await this.getStats(target));
      } else {
        stats.push({
          target,
          totalRecords: 0,
          lastImportAt: null,
          sessionCount: 0,
          fieldCounts: {},
        });
      }
    }

    return stats;
  }
}
