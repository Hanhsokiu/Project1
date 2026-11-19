"use strict";
const {
  id,
  date,
  plus,
  areas,
  terms,
  participants,
  hash,
} = require("./definition.cjs");
function contentFor(p) {
  return {
    schemaVersion: 1,
    objectives:
      "Xây dựng sản phẩm minh họa hỗ trợ học tập bằng dữ liệu tổng hợp, đánh giá chất lượng bằng kiểm thử.",
    scope:
      "Phạm vi một đơn vị đào tạo mô phỏng, không sử dụng thông tin cá nhân thật.",
    mainContents:
      "Khảo sát yêu cầu; phân tích mô hình dữ liệu; thiết kế giao diện; phát triển API; kiểm thử và đánh giá kết quả.",
    tools: "TypeScript, React, NestJS, PostgreSQL và công cụ kiểm thử tự động.",
    expectedResults:
      "Phần mềm có mã nguồn, báo cáo PDF và minh chứng kiểm thử có thể tái hiện.",
    startsAt: date(p.term.guidance[0]).toISOString(),
    endsAt: date(p.term.guidance[1]).toISOString(),
    schedule: Array.from({ length: 3 }, (_, i) => ({
      label: [
        "Phân tích và thiết kế",
        "Phát triển chức năng",
        "Kiểm thử và hoàn thiện",
      ][i],
      startsAt: plus(p.term.guidance[0], i * 28).toISOString(),
      endsAt: plus(p.term.guidance[0], (i + 1) * 28).toISOString(),
      deliverables: "Báo cáo PDF, mã nguồn ZIP và kết quả kiểm thử tổng hợp.",
    })),
  };
}
async function seedProposals(ctx) {
  const Pdf = ctx.local.req(
      "./dist/topic/proposal-dossiers/dossier-pdf.service",
    ).DossierPdfService,
    pdf = new Pdf();
  const shared = ctx.local.req("@doan/shared");
  for (const t of terms) {
    await ctx.phase("review-groups-" + t.key, async (tx) => {
      for (let g = 0; g < 3; g++) {
        const groupId = id(`review-group/${t.key}/${g}`),
          at = date(t.proposal[0]);
        await ctx.put(tx, "reviewGroup", {
          id: groupId,
          termId: t.id,
          name: `Nhóm duyệt DEMO ${g + 1} · ${t.code}`,
          createdAt: at,
        });
        await ctx.put(tx, "reviewGroupWorkflow", {
          id: id(`review-group-workflow/${t.key}/${g}`),
          groupId,
          departmentId: id("department"),
          revision: 1,
          createdAt: at,
          updatedAt: at,
        });
        for (let j = 0; j < 6; j++) {
          const lecturerId = id(`lecturer/${g * 6 + j + 1}`);
          await tx.reviewGroupMember.create({
            data: { reviewGroupId: groupId, lecturerId },
          });
          await ctx.put(tx, "reviewMembershipHistory", {
            id: id(`review-member-history/${t.key}/${g}/${j}`),
            groupId,
            lecturerId,
            actorId: id("user/faculty/1"),
            action: "ADDED",
            reason: "Khởi tạo nhóm duyệt tổng hợp DEMO V3",
            createdAt: at,
            updatedAt: at,
          });
        }
      }
    });
    for (const p of participants(t))
      await ctx.phase("proposal-dossier-" + p.key, async (tx) => {
        const { key, student: s, advisor: a } = p,
          proposalId = id("proposal/" + key),
          at = date(t.proposal[0]),
          dossierId = id("dossier/" + key),
          content = contentFor(p);
        shared.SubmittedProposalContentSchema.parse(content);
        await ctx.put(tx, "proposal", {
          id: proposalId,
          topicId: id("topic/" + key),
          studentId: s.id,
          termId: t.id,
          status: "APPROVED",
          createdAt: at,
          updatedAt: plus(t.proposal[0], 12),
        });
        const versions = p.index % 10 === 0 ? 3 : p.index % 3 === 0 ? 2 : 1;
        // All intermediate versions and decisions are retained as synthetic historical fixtures.
        for (let v = 1; v <= versions; v++) {
          const versionId = id(`version/${key}/${v}`),
            reviewId = id(`review/${key}/${v}`),
            submittedAt = plus(t.proposal[0], v * 3),
            decidedAt = plus(t.proposal[0], v * 3 + 1),
            group = a.n % 3,
            reviewerNumber = group * 6 + 1,
            reviewerUser = id("user/gv/" + reviewerNumber);
          const value = {
            ...content,
            mainContents:
              content.mainContents +
              (v === versions
                ? " Đã bổ sung minh chứng theo góp ý."
                : " Bản ban đầu cần bổ sung minh chứng."),
          };
          await ctx.put(tx, "proposalVersion", {
            id: versionId,
            proposalId,
            version: v,
            content: value,
            status: v === versions ? "APPROVED" : "REVISION_REQUESTED",
            createdBy: s.userId,
            submittedAt,
            createdAt: plus(t.proposal[0], v * 3 - 1),
          });
          await ctx.put(tx, "proposalVersionWorkflow", {
            id: id(`version-workflow/${key}/${v}`),
            versionId,
            state: "SEALED",
            contentSchemaVersion: 1,
            contentHash: hash(value),
            submittedAt,
            createdByUserId: s.userId,
            submittedByUserId: s.userId,
            basedOnVersionId: v > 1 ? id(`version/${key}/${v - 1}`) : null,
            changeSummary:
              v > 1
                ? "Bổ sung thiết kế và minh chứng kiểm thử theo yêu cầu duyệt"
                : null,
            provenance: { synthetic: true, profile: "UTC_PROJECT1_DEMO_V3" },
            revisionResponses:
              v > 1
                ? [
                    {
                      targetType: "DECISION",
                      targetId: id(`decision/${key}/${v - 1}`),
                      text: "Đã cập nhật nội dung và kế hoạch kiểm thử.",
                    },
                  ]
                : [],
            revision: 1,
            createdAt: plus(t.proposal[0], v * 3 - 1),
            updatedAt: submittedAt,
          });
          await ctx.put(tx, "proposalReview", {
            id: reviewId,
            proposalId,
            reviewGroupId: id(`review-group/${t.key}/${group}`),
            decision: v === versions ? "APPROVED" : "REVISION_REQUESTED",
            comment:
              v === versions
                ? "[DEMO] Đề cương đáp ứng phạm vi và có kế hoạch kiểm thử."
                : "[DEMO] Cần bổ sung tiêu chí kiểm thử và kết quả dự kiến.",
            reviewedAt: decidedAt,
            createdAt: submittedAt,
          });
          await ctx.put(tx, "proposalReviewWorkflow", {
            id: id(`review-workflow/${key}/${v}`),
            reviewId,
            proposalId,
            versionId,
            roundNumber: v,
            state: "DECIDED",
            phaseSnapshot: {
              synthetic: true,
              termId: t.id,
              phaseId: id(`phase/${t.key}/PROPOSAL_REVIEW`),
              revision: 0,
            },
            routingSnapshot: {
              departmentId: id("department"),
              researchAreaId: id("area/" + areas[(a.n - 1) % 5]),
              revision: 0,
            },
            assignedAt: submittedAt,
            assignedByUserId: id("user/faculty/1"),
            startedAt: submittedAt,
            startedByUserId: reviewerUser,
            revision: 2,
            createdAt: submittedAt,
            updatedAt: decidedAt,
          });
          await ctx.put(tx, "proposalReviewDecision", {
            id: id(`decision/${key}/${v}`),
            reviewId,
            versionId,
            decision: v === versions ? "APPROVED" : "REVISION_REQUIRED",
            comment:
              v === versions
                ? "[DEMO] Đã đối chiếu bản sửa với góp ý."
                : "[DEMO] Bổ sung kiểm thử và ranh giới phạm vi.",
            decidedAt,
            decidedByUserId: reviewerUser,
            createdAt: decidedAt,
            updatedAt: decidedAt,
          });
          await ctx.put(tx, "reviewComment", {
            id: id(`review-comment/${key}/${v}`),
            reviewId,
            versionId,
            authorUserId: reviewerUser,
            text: "[DEMO] Nhận xét gắn đúng phiên bản: làm rõ phương pháp đánh giá và minh chứng.",
            createdAt: submittedAt,
            updatedAt: submittedAt,
          });
        }
        const versionId = id(`version/${key}/${versions}`),
          approved = (
            await tx.proposalVersion.findUniqueOrThrow({
              where: { id: versionId },
            })
          ).content;
        await ctx.put(tx, "proposalWorkflow", {
          id: id("proposal-workflow/" + key),
          proposalId,
          workingVersionId: versionId,
          submittedVersionId: versionId,
          nextVersionNumber: versions + 1,
          nextReviewRound: versions + 1,
          submissionKind: versions > 1 ? "RESUBMISSION" : "INITIAL",
          revision: versions * 3 + 1,
          createdAt: at,
          updatedAt: plus(t.proposal[0], versions * 3 + 1),
        });
        const finalizedAt = plus(t.proposal[0], versions * 3 + 2),
          snapshot = {
            schemaVersion: 1,
            title: (
              await tx.topic.findUniqueOrThrow({
                where: { id: id("topic/" + key) },
              })
            ).title,
            termName: `${t.code} · Đồ án CNTT (mô phỏng)`,
            student: {
              id: s.id,
              name: s.name,
              code: "DEMO-SV" + String(s.n).padStart(3, "0"),
              className: "DEMO-CNTT-K64-" + (1 + (s.n % 3)),
              majorName: "Công nghệ thông tin",
              trainingSystem: "Chính quy (DEMO)",
              cohort: "DEMO-K64",
              phone: "0000000000",
              email: s.username + "@example.invalid",
            },
            advisor: {
              id: a.id,
              name: a.name,
              department: "Bộ môn CNTT — dữ liệu mô phỏng",
              phone: "0000000000",
              email: a.username + "@example.invalid",
            },
            academicProfileRevision: 1,
            assignmentId: id("assignment/" + key),
            assignmentRevision: 0,
            topicRevision: 1,
            content: approved,
          };
        const finalizationId = id("finalization/" + key),
          assetId = id("dossier-pdf/" + key),
          rendered = await pdf.render(
            snapshot,
            "DEMO V3 — TỔNG HỢP, CHƯA KÝ · " + finalizationId,
            finalizedAt,
          );
        await ctx.put(tx, "fileAsset", {
          id: assetId,
          kind: "DOSSIER_PDF",
          state: "READY",
          storageKey: "db:dossier-pdf/" + assetId,
          originalName: `DEMO-${t.key}-${s.n}-de-cuong.pdf`,
          sizeBytes: rendered.bytes.length,
          mimeType: "application/pdf",
          checksum: hash(rendered.bytes),
          createdByUserId: id("user/faculty/1"),
          createdAt: finalizedAt,
          updatedAt: finalizedAt,
        });
        await tx.dossierPdfContent.create({
          data: { assetId, bytes: rendered.bytes },
        });
        await ctx.put(tx, "thesisDossier", {
          id: dossierId,
          proposalId,
          status: "APPROVED",
          submittedAt: finalizedAt,
          createdAt: finalizedAt,
          updatedAt: finalizedAt,
        });
        await ctx.put(tx, "dossierFinalization", {
          id: finalizationId,
          dossierId,
          proposalId,
          versionId,
          sequence: 1,
          templateVersion: shared.DOSSIER_TEMPLATE_VERSION,
          contentHash: hash(snapshot),
          printSnapshot: snapshot,
          approvalDecisionId: id(`decision/${key}/${versions}`),
          finalizedAt,
          finalizedByUserId: id("user/faculty/1"),
          pdfAssetId: assetId,
          createdAt: finalizedAt,
          updatedAt: finalizedAt,
        });
        await ctx.put(tx, "dossierWorkflow", {
          id: id("dossier-workflow/" + key),
          dossierId,
          state: "RECEIVED",
          revision: 2,
          currentFinalizationId: finalizationId,
          createdAt: finalizedAt,
          updatedAt: plus(finalizedAt, 1),
        });
        await ctx.put(tx, "dossierReceipt", {
          id: id("receipt/" + key),
          finalizationId,
          receivedByUserId: id("user/faculty/2"),
          receivedAt: plus(finalizedAt, 1),
          note: "[DEMO] Biên nhận mô phỏng; không khẳng định có bản giấy/chữ ký thật.",
          createdAt: plus(finalizedAt, 1),
          updatedAt: plus(finalizedAt, 1),
        });
        for (const [i, action] of [
          "FINALIZED",
          "PDF_GENERATED",
          "RECEIVED",
        ].entries())
          await ctx.put(tx, "dossierHistory", {
            id: id(`dossier-history/${key}/${action}`),
            dossierId,
            actorId: id("user/faculty/" + (action === "RECEIVED" ? 2 : 1)),
            action,
            reason:
              "Fixture lịch sử tổng hợp DEMO V3; không phải thao tác của người dùng bên ngoài",
            snapshot: {
              synthetic: true,
              finalizationId,
              versionId,
              contentHash: hash(snapshot),
              pdfAssetId: assetId,
            },
            createdAt: plus(finalizedAt, i / 2),
            updatedAt: plus(finalizedAt, i / 2),
          });
      });
  }
}
module.exports = { contentFor, seedProposals };
