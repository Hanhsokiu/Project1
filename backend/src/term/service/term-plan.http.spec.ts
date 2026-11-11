import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ThesisTermController } from "../controller/thesis-term.controller";
import { TermLifecycleService } from "./term-lifecycle.service";
import { TermWindowService } from "./term-window.service";
import { QuotaService } from "./quota.service";
import { defaultPhasePlan } from "../validator/term-configuration.validator";
import { JwtAuthGuard } from "../../common/security/jwt-auth.guard";
import { PermissionsGuard } from "../../common/security/permissions.guard";
import { RbacService } from "../../auth/service/rbac.service";
import type { UserAccountRepository } from "../../auth/repository/user-account.repository";

let app: INestApplication;
afterEach(async () => { await app?.close(); });
describe("plan API validates JWT, permission and reason before calling the service", () => {
  it("denies a lecturer and a faculty without term:plan; forwards a valid reason for an authorized planner", async () => {
    const service = { savePhases:vi.fn().mockResolvedValue({ status:"IN_PROGRESS" }) };
    const jwt = new JwtService({ secret:"synthetic-plan-http-secret-only" });
    const users = {
      findById:async (id:string) => ({ id, username:id, status:"ACTIVE", mustChangePassword:false,
        userRoles:[{ role:{ name:id === "lecturer" ? "LECTURER":"FACULTY", rolePermissions:[] } }] }),
      session:async (id:string) => ({ id, userId:id, revokedAt:null, expiresAt:new Date(Date.now()+60000) }),
      permissions:async (id:string) => id === "planner" ? ["term:plan"] : [],
    } as unknown as UserAccountRepository;
    Reflect.defineMetadata("design:paramtypes", [TermLifecycleService, TermWindowService, QuotaService], ThesisTermController);
    const module = await Test.createTestingModule({ controllers:[ThesisTermController], providers:[
      { provide:TermLifecycleService,useValue:service }, { provide:TermWindowService,useValue:{} },
      { provide:QuotaService,useValue:{} },
    ] }).compile();
    app = module.createNestApplication({ logger:false });
    const reflector = new Reflector();
    app.useGlobalGuards(new JwtAuthGuard(reflector,jwt,users),new PermissionsGuard(reflector,new RbacService(users)));
    await app.listen(0,"127.0.0.1");
    const root = await app.getUrl();
    const body = { phases:defaultPhasePlan(new Date("2030-01-01Z"),new Date("2030-06-01Z")), reason:"Approved plan extension" };
    const put = (actor:string,payload:unknown=body) => fetch(root+"/terms/owned/phases", { method:"PUT",headers:{
      "Content-Type":"application/json", ...(actor ? { Authorization:"Bearer "+jwt.sign({ sub:actor,sid:actor },{ expiresIn:"1m" }) } : {}),
    },body:JSON.stringify(payload) });
    expect((await put("")).status).toBe(401);
    expect((await put("lecturer")).status).toBe(403);
    expect((await put("faculty-without-permission")).status).toBe(403);
    expect((await put("planner",{ ...body,reason:"x" })).status).toBe(400);
    expect(service.savePhases).not.toHaveBeenCalled();
    expect((await put("planner")).status).toBe(200);
    expect(service.savePhases).toHaveBeenCalledWith("owned",body.phases,"planner",body.reason);
  });
});
