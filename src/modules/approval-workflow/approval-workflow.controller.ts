import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../../common/constants/permissions';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { ApiErrorResponses, ApiSuccessResponse, ApiMessageResponse } from '../../common/decorators/api-response.decorator';

@ApiTags('approval-workflow')
@ApiBearerAuth()
@ApiErrorResponses()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('approval-workflow')
export class ApprovalWorkflowController {
  constructor(private service: ApprovalWorkflowService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.APPROVAL.READ)
  @ApiOperation({ summary: 'List all approval workflows' })
  @ApiSuccessResponse()
  @ApiQuery({ name: 'groupBrandId', required: false })
  async findAll(@Query('groupBrandId') groupBrandId?: string) {
    return this.service.findAll(groupBrandId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.APPROVAL.READ)
  @ApiOperation({ summary: 'Get workflow by ID with levels' })
  @ApiSuccessResponse()
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get('group-brand/:groupBrandId')
  @RequirePermissions(PERMISSIONS.APPROVAL.READ)
  @ApiOperation({ summary: 'Get workflows for a group brand' })
  @ApiSuccessResponse()
  async findByGroupBrand(@Param('groupBrandId') groupBrandId: string) {
    return this.service.findByGroupBrand(groupBrandId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.APPROVAL.WRITE)
  @ApiOperation({ summary: 'Create a new approval workflow' })
  @ApiSuccessResponse('Workflow created')
  async create(@Body() body: {
    groupBrandId: string;
    workflowName: string;
    levels?: Array<{
      levelOrder: number;
      levelName: string;
      approverUserId: string;
      isRequired: boolean;
    }>;
  }) {
    return this.service.create(body);
  }

  @Post(':id/levels')
  @RequirePermissions(PERMISSIONS.APPROVAL.WRITE)
  @ApiOperation({ summary: 'Add a level to a workflow' })
  @ApiSuccessResponse('Level added')
  async addLevel(@Param('id') id: string, @Body() body: {
    levelOrder: number;
    levelName: string;
    approverUserId: string;
    isRequired: boolean;
  }) {
    return this.service.addLevel(id, body);
  }

  @Patch('levels/:levelId')
  @RequirePermissions(PERMISSIONS.APPROVAL.WRITE)
  @ApiOperation({ summary: 'Update a workflow level' })
  @ApiSuccessResponse('Level updated')
  async updateLevel(@Param('levelId') levelId: string, @Body() body: {
    levelOrder?: number;
    levelName?: string;
    approverUserId?: string;
    isRequired?: boolean;
  }) {
    return this.service.updateLevel(levelId, body);
  }

  @Delete('levels/:levelId')
  @RequirePermissions(PERMISSIONS.APPROVAL.WRITE)
  @ApiOperation({ summary: 'Remove a workflow level' })
  @ApiMessageResponse('Level deleted')
  async removeLevel(@Param('levelId') levelId: string) {
    return this.service.removeLevel(levelId);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.APPROVAL.WRITE)
  @ApiOperation({ summary: 'Delete a workflow' })
  @ApiMessageResponse('Workflow deleted')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/reorder')
  @RequirePermissions(PERMISSIONS.APPROVAL.WRITE)
  @ApiOperation({ summary: 'Reorder workflow levels' })
  @ApiSuccessResponse('Levels reordered')
  async reorderLevels(@Param('id') id: string, @Body('levelIds') levelIds: string[]) {
    return this.service.reorderLevels(id, levelIds);
  }
}
