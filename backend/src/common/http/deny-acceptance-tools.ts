import type { INestApplication } from "@nestjs/common";
import type { Request, Response } from "express";

/** Normal bootstrap never serves acceptance tools, regardless of environment flags. */
export function denyAcceptanceTools(app: INestApplication, apiPrefix: string) {
  app.use(`/${apiPrefix}/acceptance`, (_request: Request, response: Response) => {
    response.status(404).json({ statusCode: 404, message: "Not Found" });
  });
}
