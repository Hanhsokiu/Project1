import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationService } from '../service/notification.service';
import { ApiResponse } from '../../common/dto/api-response.dto';

@ApiTags('notification')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifService: NotificationService) {}

  @Get('user/:userId')
  async getNotifications(@Param('userId') userId: string) {
    const list = await this.notifService.getUserNotifications(userId);
    return ApiResponse.ok(list);
  }
}
