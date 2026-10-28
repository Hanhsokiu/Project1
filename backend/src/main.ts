import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { GlobalExceptionHandler } from "./common/exception/global-exception.handler";
import { describeStep1 } from "./common/swagger/step1-document";
import { describeStep3 } from "./common/swagger/step3-document";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const apiPrefix = config.get<string>("API_PREFIX", "api");
  app.setGlobalPrefix(apiPrefix);

  app.enableCors({
    origin: config
      .get<string>(
        "FRONTEND_URL",
        "http://localhost:5173,http://127.0.0.1:5173",
      )
      .split(",")
      .map((origin) => origin.trim()),
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionHandler());
  app.enableShutdownHooks();

  if (config.get<string>("NODE_ENV") !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("QLDATN API")
      .setDescription("Hệ thống Quản lý Đồ án Tốt nghiệp")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = describeStep3(
      describeStep1(
        SwaggerModule.createDocument(app, swaggerConfig),
        apiPrefix,
      ),
      apiPrefix,
    );
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  const port = config.get<number>("PORT", 3000);
  await app.listen(port);
  console.log(`Application running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`Swagger docs: http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap();
