import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { Controller, Get, Post, type INestApplication } from "@nestjs/common";
import { denyAcceptanceTools } from "./deny-acceptance-tools";

@Controller("acceptance")
class AccidentalTestController {
  calls = 0;
  @Post("clock") clock() { this.calls++; return { changed: true }; }
  @Get("status") status() { return { kind: "ISOLATED_STAGING_TEST" }; }
}
let app: INestApplication;
afterEach(async () => { await app?.close(); });
describe("normal backend refuses test tools at HTTP layer", () => {
  it.each(["api", "v1/api"])("blocks even an accidentally imported controller under /%s", async prefix => {
    const module = await Test.createTestingModule({ controllers: [AccidentalTestController] }).compile();
    app = module.createNestApplication({ logger: false });
    denyAcceptanceTools(app, prefix);
    app.setGlobalPrefix(prefix);
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const before = Date.now();
    for (const [method, route] of [["POST", "clock"], ["GET", "status"]]) {
      const response = await fetch(`${base}/${prefix}/acceptance/${route}`, { method });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ statusCode: 404, message: "Not Found" });
    }
    expect(module.get(AccidentalTestController).calls).toBe(0);
    expect(Date.now()).toBeGreaterThanOrEqual(before);
  });
});
