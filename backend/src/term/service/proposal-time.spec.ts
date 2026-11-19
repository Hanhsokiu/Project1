import { afterEach, describe, expect, it, vi } from "vitest";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { ProposalVersionValidator } from "../../topic/proposal-versions/proposal-version.validator";
import type { ProposalReviewSession } from "../../topic/proposal-reviews/proposal-review.repository";
import type { ProposalVersionSession } from "../../topic/proposal-versions/proposal-version.repository";
afterEach(() => vi.useRealTimers());
describe.each(["review", "edit"])("proposal %s honors term bounds and lock in addition to phase", kind => {
  const review = new ProposalReviewValidator();
  function fixture() {
    const term = { status:"IN_PROGRESS", isLocked:false,
      startDate:new Date("2030-11-01Z"), endDate:new Date("2030-12-01Z") };
    const phase = { refPhaseId:{ termId:"owned", isLocked:false,
      startDate:new Date("2030-10-01Z"),endDate:new Date("2031-01-01Z") } };
    const session = { term:async()=>term, phase:async()=>phase,editPhase:async()=>phase };
    const check = () => kind === "review" ? review.phase(session as unknown as ProposalReviewSession,"owned") :
      new ProposalVersionValidator(review).phase(session as unknown as ProposalVersionSession,"owned");
    return {term,check};
  }
  it.each([["2030-10-31T23:59:59.999Z",false],["2030-11-01T00:00:00Z",true],
    ["2030-11-30T23:59:59.999Z",true],["2030-12-01T00:00:00Z",false]] as const)("checks %s",async(at,allowed)=>{
    vi.useFakeTimers();vi.setSystemTime(new Date(at));const f=fixture();
    if(allowed)await expect(f.check()).resolves.toBeDefined();else await expect(f.check()).rejects.toThrow();
  });
  it("refuses a locked term even while the phase is open",async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date("2030-11-15Z"));const f=fixture();
    f.term.isLocked=true;await expect(f.check()).rejects.toThrow();
  });
});
