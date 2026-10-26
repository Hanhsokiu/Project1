"use strict";
const { testTarget } = require("../rehearse-pr2b.cjs");

// Synthetic accounts only, on the same guarded loopback target as the API suites.
// Each token must reference a persisted, non-revoked session after step 1 auth.
async function prepareFixtureSessions(db) {
  testTarget(process.env.PR2B_TEST_URL);
  const users = await db.userAccount.findMany({ select: { id: true } });
  await db.userAccount.updateMany({ data: { mustChangePassword: false } });
  for (const { id } of users) {
    await db.loginSession.upsert({
      where: { id },
      create: {
        id,
        userId: id,
        refreshToken: "synthetic-not-for-refresh",
        expiresAt: new Date(Date.now() + 3600000),
      },
      update: {},
    });
  }
}
module.exports = { prepareFixtureSessions };
