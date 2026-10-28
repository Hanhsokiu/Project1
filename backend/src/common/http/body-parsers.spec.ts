import {
  Body,
  Controller,
  Module,
  Post,
  Put,
  type INestApplication,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  configureBodyParsers,
  PROPOSAL_VERSION_JSON_LIMIT,
} from "./body-parsers";
import { GlobalExceptionHandler } from "../exception/global-exception.handler";
import { ProposalVersionSaveSchema, emptyProposalContent } from "@doan/shared";

@Controller()
class TransportController {
  @Post("proposals/:id/versions")
  save(@Body() input: { value: string }) {
    return { length: input.value.length };
  }
  @Put("proposals/:id/versions")
  put(@Body() input: { value: string }) {
    return { length: input.value.length };
  }
  @Post("other")
  other(@Body() input: { value: string }) {
    return { length: input.value.length };
  }
}
@Module({ controllers: [TransportController] })
class TransportModule {}

describe("bounded proposal JSON transport with production filters", () => {
  let app: INestApplication, base: string;
  beforeAll(async () => {
    app = await NestFactory.create(TransportModule, {
      bodyParser: false,
      logger: false,
    });
    app.setGlobalPrefix("custom-api");
    configureBodyParsers(app, "custom-api");
    app.useGlobalFilters(new GlobalExceptionHandler());
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/custom-api`;
  });
  afterAll(async () => {
    await app?.close();
  });
  async function request(path: string, value: string, method = "POST") {
    return fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
  }
  it("accepts UTF-8 proposal content above the old 100 KiB limit", async () => {
    const response = await request("/proposals/p/versions", "đ".repeat(60000));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ length: 60000 });
  });
  it("keeps the small JSON budget on other routes and methods", async () => {
    for (const [path, method] of [
      ["/other", "POST"],
      ["/proposals/p/versions", "PUT"],
    ]) {
      const response = await request(path, "x".repeat(110000), method);
      expect(response.status).toBe(413);
      expect(await response.json()).toMatchObject({
        success: false,
        error: { code: "PAYLOAD_TOO_LARGE" },
      });
    }
  });
  it("rejects a proposal request above its hard cap without returning 500", async () => {
    const response = await request(
      "/proposals/p/versions",
      "x".repeat(PROPOSAL_VERSION_JSON_LIMIT),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "PAYLOAD_TOO_LARGE" },
    });
  });
  it("fits the largest escaped text allowed by the existing save DTO", () => {
    const text = "\u0000".repeat(20000);
    const input = {
      expectedRevision: 0,
      content: {
        ...emptyProposalContent,
        objectives: text,
        scope: text,
        mainContents: text,
        tools: text,
        expectedResults: text,
        schedule: Array.from({ length: 100 }, () => ({
          label: "\u0000".repeat(255),
          startsAt: "",
          endsAt: "",
          deliverables: text,
        })),
      },
      responses: Array.from({ length: 200 }, (_, index) => ({
        targetType: "COMMENT",
        targetId: String(index),
        text: "\u0000".repeat(10000),
      })),
    };
    expect(ProposalVersionSaveSchema.safeParse(input).success).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThan(
      PROPOSAL_VERSION_JSON_LIMIT,
    );
  });
});
