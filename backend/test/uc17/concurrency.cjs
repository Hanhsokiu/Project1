"use strict";
const assert = require("node:assert/strict");
const { setTimeout: delay } = require("node:timers/promises");

function gate(timeout = 12000) {
  let resolve, timer;
  const promise = new Promise((yes, no) => {
    resolve = () => {
      clearTimeout(timer);
      yes();
    };
    timer = setTimeout(
      () => no(new Error("Integration barrier timeout")),
      timeout,
    );
    timer.unref();
  });
  // A timed-out barrier is reported by its consumer, never as an unhandled rejection.
  promise.catch(() => {});
  return { promise, release: resolve };
}

async function poll(operation, message, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await operation();
    if (value) return value;
    await delay(25);
  }
  throw new Error(message);
}

async function waitBlocked(observer, names, count = names.length) {
  return poll(async () => {
    const rows = await observer.$queryRaw`SELECT pid, application_name AS name,
      cardinality(pg_blocking_pids(pid))::int AS blockers
      FROM pg_stat_activity WHERE datname=current_database()
      AND application_name IN (${names[0]},${names[1] || names[0]})
      AND wait_event_type='Lock'`;
    return rows.length >= count && rows.every((r) => r.blockers > 0)
      ? rows
      : false;
  }, "Expected independent PostgreSQL sessions waiting on real locks");
}

async function holdTerm(client, termId) {
  const entered = gate(),
    release = gate();
  const done = client.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${termId} FOR UPDATE`;
      entered.release();
      await release.promise;
    },
    { timeout: 20000 },
  );
  done.catch(() => {});
  await entered.promise;
  return {
    async release() {
      release.release();
      await done;
    },
  };
}

function pauseStorage(storage, method = "readPrivateFinalReport") {
  const original = storage[method],
    entered = gate(),
    release = gate();
  storage[method] = async function (...args) {
    entered.release();
    await release.promise;
    return original.apply(this, args); // REAL private storage I/O, not fake bytes.
  };
  return {
    entered: entered.promise,
    release: release.release,
    restore() {
      release.release();
      storage[method] = original;
    },
  };
}

async function afterDatabaseTime(observer, time) {
  await poll(async () => {
    const [row] = await observer.$queryRaw`SELECT clock_timestamp() AS at`;
    return row.at >= time;
  }, "Database clock did not reach the UC17 deadline");
}

async function expectSqlFailure(operation, codes) {
  let error;
  try {
    await operation();
  } catch (caught) {
    error = caught;
  }
  assert(error, "Expected a PostgreSQL/Prisma integrity rejection");
  assert(
    codes.includes(error.code) || codes.includes(error.meta?.code),
    `Unexpected database error category: ${error.code}/${error.meta?.code}`,
  );
  return error;
}
module.exports = {
  gate,
  poll,
  waitBlocked,
  holdTerm,
  pauseStorage,
  afterDatabaseTime,
  expectSqlFailure,
};
