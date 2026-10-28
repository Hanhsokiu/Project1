import type { INestApplication } from "@nestjs/common";
import { json, urlencoded } from "express";
import type { Request, Response, NextFunction } from "express";

// Covers the bounded ProposalVersionSave DTO, including escaped UTF-8 text in
// 100 schedule rows and 200 feedback responses. Other JSON routes keep 100 KiB.
export const PROPOSAL_VERSION_JSON_LIMIT = 32 * 1024 * 1024;

export function configureBodyParsers(app: INestApplication, prefix = "api") {
  const routePrefix = "/" + prefix.replace(/^\/+|\/+$/g, "");
  const proposalJson = json({ limit: PROPOSAL_VERSION_JSON_LIMIT });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const path = request.path;
    if (
      request.method === "POST" &&
      path.startsWith(routePrefix + "/proposals/") &&
      /^\/[^/]+\/versions\/?$/.test(
        path.slice((routePrefix + "/proposals").length),
      )
    )
      return proposalJson(request, response, next);
    next();
  });
  app.use(json({ limit: 100 * 1024 }));
  app.use(urlencoded({ extended: true, limit: 100 * 1024 }));
}
