import { Prisma } from "@prisma/client";

type Arguments = Record<string, unknown>;
type Row = Record<string, unknown>;
type Delegate = { findMany(args: Arguments): PromiseLike<Row[]> };
const readTransactions = new WeakSet<object>();
export async function mapDefenseReads<T, R>(
  tx: Prisma.TransactionClient,
  items: T[],
  load: (item: T) => Promise<R>,
): Promise<R[]> {
  if (readTransactions.has(tx)) return Promise.all(items.map(load));
  // Commands and other callers retain their original sequential execution.
  const results: R[] = [];
  for (const item of items) results.push(await load(item));
  return results;
}
const partitions: Record<string, string[]> = {
  auditLog: ["resourceId"],
  weeklyReportObligation: ["termStudentId"],
  periodRequiredStudent: ["termStudentId"],
  reviewerAssignment: ["reviewerId"],
  scoreEntry: ["proposalId", "scorerId"],
};
const uniqueKeys = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [
    model.name[0].toLowerCase() + model.name.slice(1),
    [
      ...model.fields
        .filter((field) => field.isId || field.isUnique)
        .map((field) => [field.name]),
      ...model.uniqueFields,
      ...(model.primaryKey ? [model.primaryKey.fields] : []),
    ],
  ]),
);
const keyOf = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? { bigint: item.toString() } : item,
  );

/** Only wrap RepeatableRead GET transactions. Commands must use the original tx.
 * Results never survive the callback, and every other filter/projection remains
 * part of the key. Service authorization and evidence validation still execute.
 */
export function defenseReadTransaction(tx: Prisma.TransactionClient) {
  const reads = new Map<string, Promise<unknown>>();
  const delegates = new Map<string, object>();
  const groups = new Map<
    string,
    Array<{
      id: string;
      args: Arguments;
      resolve: (rows: Row[]) => void;
      reject: (error: unknown) => void;
    }>
  >();
  const uniqueGroups = new Map<
    string,
    Array<{
      where: Arguments;
      resolve: (row: Row | null) => void;
      reject: (error: unknown) => void;
    }>
  >();
  function unique(
    delegate: Delegate,
    model: string,
    args: Arguments,
  ): Promise<Row | null> | null {
    const where: Arguments = {};
    const compounds: Record<string, string[]> = {
      termId_key: ["termId", "key"],
      termId_studentId: ["termId", "studentId"],
      termId_lecturerId: ["termId", "lecturerId"],
      proposalId_scorerId_role: ["proposalId", "scorerId", "role"],
    };
    if (!args.where || typeof args.where !== "object") return null;
    for (const [key, value] of Object.entries(args.where)) {
      if (value && typeof value === "object") {
        const fields = compounds[key];
        if (
          !fields ||
          Object.keys(value).length !== fields.length ||
          fields.some(
            (field) => typeof (value as Arguments)[field] !== "string",
          )
        )
          return null;
        Object.assign(where, value);
      } else if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      )
        where[key] = value;
      else return null;
    }
    const fields = Object.keys(where).sort();
    if (
      !fields.length ||
      !uniqueKeys
        .get(model)
        ?.some((key) => key.every((field) => fields.includes(field)))
    )
      return null;
    if (model === "termLecturer" && fields.join(",") === "lecturerId,termId") {
      const select = args.select as Arguments | undefined;
      const added = select ? fields.filter((field) => !select[field]) : [];
      const query = {
        ...args,
        where: { termId: where.termId },
        ...(select
          ? { select: { ...select, termId: true, lecturerId: true } }
          : {}),
      };
      return memo(keyOf([model, "roster", query]), () =>
        delegate.findMany(query),
      ).then((value) => {
        const row = (value as Row[]).find((row) =>
          fields.every((field) => row[field] === where[field]),
        );
        if (!row) return null;
        const result = { ...row };
        for (const field of added) delete result[field];
        return result;
      });
    }
    const signature = keyOf([model, { ...args, where: fields }]);
    let pending = uniqueGroups.get(signature);
    if (!pending) {
      pending = [];
      uniqueGroups.set(signature, pending);
      queueMicrotask(async () => {
        const batch = uniqueGroups.get(signature)!;
        uniqueGroups.delete(signature);
        try {
          const select = args.select as Arguments | undefined;
          const added = select ? fields.filter((field) => !select[field]) : [];
          // Explicit findMany avoids Prisma 5's implicit findUnique batching of
          // relation-join projections, and keeps missing unique rows as null.
          const rows = await delegate.findMany({
            ...args,
            // Avoid repeating the same large assignment-plan snapshot in a
            // lateral JSON join for every registration in the batch.
            ...(model === "registration" && args.include
              ? { relationLoadStrategy: "query" }
              : {}),
            where: { OR: batch.map((item) => item.where) },
            ...(select
              ? {
                  select: {
                    ...select,
                    ...Object.fromEntries(fields.map((field) => [field, true])),
                  },
                }
              : {}),
          });
          for (const item of batch) {
            const row = rows.find((row) =>
              fields.every((field) => row[field] === item.where[field]),
            );
            if (!row) {
              item.resolve(null);
              continue;
            }
            const result = { ...row };
            for (const field of added) delete result[field];
            item.resolve(result);
          }
        } catch (error) {
          for (const item of batch) item.reject(error);
        }
      });
    }
    return new Promise((resolve, reject) =>
      pending!.push({ where, resolve, reject }),
    );
  }
  function many(model: string, delegate: Delegate, args: Arguments) {
    const fields = partitions[model] ?? [];
    const where = args.where as Arguments | undefined;
    const values = fields.map((field) => where?.[field]);
    const id =
      fields.length && values.every((value) => typeof value === "string")
        ? keyOf(values)
        : null;
    const take = args.take as number | undefined;
    const skip = args.skip as number | undefined;
    if (
      typeof id !== "string" ||
      args.cursor ||
      args.distinct ||
      (take !== undefined && (!Number.isInteger(take) || take < 0)) ||
      (skip !== undefined && (!Number.isInteger(skip) || skip < 0))
    )
      return Promise.resolve(delegate.findMany(args));
    const signature = keyOf([
      model,
      {
        ...args,
        where: {
          ...where,
          ...Object.fromEntries(fields.map((field) => [field, null])),
        },
      },
    ]);
    let pending = groups.get(signature);
    if (!pending) {
      pending = [];
      groups.set(signature, pending);
      queueMicrotask(async () => {
        const batch = groups.get(signature)!;
        groups.delete(signature);
        try {
          if (batch.length === 1) {
            batch[0].resolve(await delegate.findMany(batch[0].args));
            return;
          }
          const select = args.select as Arguments | undefined;
          const addedFields = select
            ? fields.filter((field) => !select[field])
            : [];
          const pairs = batch.map((item) => {
            const values: string[] = JSON.parse(item.id);
            return Object.fromEntries(
              fields.map((field, index) => [field, values[index]]),
            );
          });
          const filter = Object.fromEntries(
            Object.entries(where!).filter(([key]) => !fields.includes(key)),
          );
          const rows = await delegate.findMany({
            ...args,
            where:
              fields.length === 1
                ? {
                    ...where,
                    [fields[0]]: {
                      in: [...new Set(pairs.map((pair) => pair[fields[0]]))],
                    },
                  }
                : { AND: [filter, { OR: pairs }] },
            ...(select
              ? {
                  select: {
                    ...select,
                    ...Object.fromEntries(fields.map((field) => [field, true])),
                  },
                }
              : {}),
            // Limits apply independently to each original query, never to the union.
            take: undefined,
            skip: undefined,
          });
          for (const item of batch) {
            let selected = rows.filter(
              (row) => keyOf(fields.map((field) => row[field])) === item.id,
            );
            const skip = (item.args.skip as number | undefined) ?? 0;
            const limit = item.args.take as number | undefined;
            selected = selected.slice(
              skip,
              limit === undefined ? undefined : skip + limit,
            );
            if (addedFields.length)
              selected = selected.map((row) => {
                const result = { ...row };
                for (const field of addedFields) delete result[field];
                return result;
              });
            item.resolve(selected);
          }
        } catch (error) {
          for (const item of batch) item.reject(error);
        }
      });
    }
    return new Promise<Row[]>((resolve, reject) =>
      pending!.push({ id, args, resolve, reject }),
    );
  }
  const memo = (key: string, load: () => PromiseLike<unknown>) => {
    let result = reads.get(key);
    if (!result) {
      // A native Promise executes a lazy Prisma query exactly once.
      result = Promise.resolve(load());
      reads.set(key, result);
    }
    return result;
  };
  const proxy = new Proxy(tx, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof key !== "string") return value;
      if (key === "$queryRaw" || key === "$queryRawUnsafe")
        return (...args: unknown[]) =>
          memo(keyOf([key, args]), () => value.apply(target, args));
      if (
        !value ||
        typeof value !== "object" ||
        !("findMany" in value || "findUnique" in value)
      )
        return typeof value === "function" ? value.bind(target) : value;
      if (!delegates.has(key))
        delegates.set(
          key,
          new Proxy(value, {
            get(delegate, method) {
              const operation = Reflect.get(delegate, method);
              if (
                !["findUnique", "findFirst", "findMany", "count"].includes(
                  String(method),
                )
              )
                return typeof operation === "function"
                  ? operation.bind(delegate)
                  : operation;
              return (args: Arguments = {}) =>
                memo(keyOf([key, method, args]), () =>
                  method === "findMany"
                    ? many(key, delegate, args)
                    : method === "findUnique"
                      ? (unique(delegate, key, args) ??
                        operation.call(delegate, args))
                      : operation.call(delegate, args),
                ).then((result) =>
                  Array.isArray(result) ? [...result] : result,
                );
            },
          }),
        );
      return delegates.get(key);
    },
  });
  readTransactions.add(proxy);
  return proxy;
}
