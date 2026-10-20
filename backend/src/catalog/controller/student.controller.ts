import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StudentService } from '../service/student.service';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { RequirePermission } from '../../common/security/require-permission.decorator';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  @RequirePermission('student', 'read')
  @ApiOperation({ summary: 'UC04: Lấy danh sách sinh viên' })
  async getStudents(@Query('page') page = 1, @Query('limit') limit = 10, @Query('search') search?: string) {
    const res = await this.studentService.findAll({ page: Number(page), limit: Number(limit), search });
    return ApiResponse.ok(res);
  }
}
