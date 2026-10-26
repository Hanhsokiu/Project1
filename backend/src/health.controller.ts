import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "./common/security/public.decorator";
import { ApiResponse } from "./common/dto/api-response.dto";
@ApiTags("health")
@Controller("health")
export class HealthController {
  @Public() @Get() health() {
    return ApiResponse.ok({
      status: "ok",
      scope: "step-1-2-3",
      serverTime: new Date().toISOString(),
    });
  }
}
