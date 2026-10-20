import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LecturerService } from '../service/lecturer.service';
import { ApiResponse } from '../../common/dto/api-response.dto';

@ApiTags('catalog')
@Controller('lecturers')
export class LecturerController {
  constructor(private readonly lecturerService: LecturerService) {}

  @Get()
  @ApiOperation({ summary: 'UC05: Lấy danh sách giảng viên' })
  async getLecturers(@Query('page') page = 1, @Query('limit') limit = 10) {
    const res = await this.lecturerService.findAll({ page: Number(page), limit: Number(limit) });
    return ApiResponse.ok(res);
  }
}
