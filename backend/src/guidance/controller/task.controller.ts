import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TaskService } from '../service/task.service';
import { ApiResponse } from '../../common/dto/api-response.dto';

@ApiTags('guidance')
@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get('plan/:planId')
  async getTasks(@Param('planId') planId: string) {
    const list = await this.taskService.findByPlan(planId);
    return ApiResponse.ok(list);
  }
}
