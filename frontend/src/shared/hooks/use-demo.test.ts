import { beforeEach, describe, expect, it, vi } from "vitest";

type MutationCallbacks = {
  onSuccess: () => unknown;
  onError: (error: Error) => unknown;
};
const fixture = vi.hoisted(() => ({
  invalidate: vi.fn(),
  terms: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  callbacks: undefined as MutationCallbacks | undefined,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: fixture.invalidate }),
  useMutation: (options: MutationCallbacks) => {
    fixture.callbacks = options;
    return { mutateAsync: vi.fn(), isPending: false };
  },
}));
vi.mock("sonner", () => ({ toast: { success: fixture.success, error: fixture.error } }));
vi.mock("../data/store", () => ({ snapshot: vi.fn(), currentUser: vi.fn() }));
vi.mock("../api/api-session", () => ({ AUTH_API: true, getAccessToken: () => "session" }));
vi.mock("./use-workflow-terms", () => ({ invalidateWorkflowTerms: fixture.terms }));
import { useAction } from "./use-demo";

beforeEach(() => {
  vi.clearAllMocks();
  fixture.invalidate.mockResolvedValue(undefined);
  fixture.terms.mockResolvedValue(undefined);
});

describe("save acknowledgement", () => {
  it("acknowledges a successful write without awaiting background API reads", async () => {
    let finishRefresh!: () => void;
    fixture.invalidate.mockReturnValue(new Promise<void>((resolve) => { finishRefresh = resolve; }));
    useAction();
    expect(fixture.callbacks!.onSuccess()).toBeUndefined();
    expect(fixture.success).toHaveBeenCalledWith("Đã lưu thay đổi");
    expect(fixture.invalidate).toHaveBeenCalledTimes(2);
    expect(fixture.invalidate.mock.calls[0][1]).toEqual({ cancelRefetch: false, throwOnError: true });
    finishRefresh();
    await Promise.resolve();
  });

  it("reports refresh failure separately from a write that already succeeded", async () => {
    fixture.invalidate.mockRejectedValue(new Error("API read unavailable"));
    useAction({ invalidateTerms: true });
    fixture.callbacks!.onSuccess();
    expect(fixture.success).toHaveBeenCalledTimes(1);
    expect(fixture.terms).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(fixture.error).toHaveBeenCalledWith(
      "Đã lưu nhưng chưa tải lại được dữ liệu. Vui lòng thử tải lại.",
    ));
  });
});
