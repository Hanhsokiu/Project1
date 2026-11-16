import {describe,it,expect} from "vitest";
import {gradeDecimal} from "../reviewer-grading/reviewer-grade.validator";
describe("two-decimal grade storage",()=>{
  it.each(["0","5","10","8.25","4.99"])("preserves allowed value %s exactly",value=>{
    expect(gradeDecimal(value,"10","0.01")).toBe(value);
  });
  it.each(["8.251","-0.01","10.01"])("rejects unsupported precision or range %s",value=>{
    expect(()=>gradeDecimal(value)).toThrow();
  });
  it("keeps the approved step constraint when two decimals can be stored",()=>{
    expect(()=>gradeDecimal("8.25","10","0.1")).toThrow();
    expect(gradeDecimal("8.25","10","0.05")).toBe("8.25");
  });
});
