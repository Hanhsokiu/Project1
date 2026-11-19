// TEST_ONLY interpreter for the CHECK-expression subset used by review tests.
// Not a PostgreSQL/PLpgSQL parser, engine, MVCC/RLS simulator or deploy tool.
// Unsupported syntax throws; tests never replace unknown expressions with PASS.
import { isDeepStrictEqual } from "util";
type Row = Record<string, unknown>;
type Node = (row: Row) => unknown;
export type SqlTruth = boolean | null;
export const sqlAnd = (a: unknown, b: unknown): SqlTruth =>
  a === false || b === false ? false : a == null || b == null ? null : true;
export const sqlOr = (a: unknown, b: unknown): SqlTruth =>
  a === true || b === true ? true : a == null || b == null ? null : false;
const sqlNot = (a: unknown): SqlTruth => (a == null ? null : !a);
const compare = (op: string, a: unknown, b: unknown): unknown => {
  if (a == null || b == null) return null;
  if (op === "=") return isDeepStrictEqual(a, b);
  if (op === "<>") return !isDeepStrictEqual(a, b);
  if (op === "~") return new RegExp(String(b)).test(String(a));
  if (typeof a !== typeof b || !["number", "string"].includes(typeof a))
    throw Error("Unsupported comparison types in TEST_ONLY evaluator");
  if (op === ">") return a > b;
  if (op === ">=") return a >= b;
  if (op === "<") return a < b;
  if (op === "<=") return a <= b;
  throw Error(`Unsupported operator ${op}`);
};
type Token = { kind: "string" | "number" | "word" | "symbol"; text: string };
function tokens(source: string): Token[] {
  const out: Token[] = [];
  let at = 0;
  while (at < source.length) {
    const rest = source.slice(at);
    const ws = /^\s+/.exec(rest);
    if (ws) {
      at += ws[0].length;
      continue;
    }
    const s = /^'(?:[^']|'')*'/.exec(rest);
    const n = /^\d+(?:\.\d+)?/.exec(rest);
    const w = /^[A-Za-z_][A-Za-z_0-9.]*/.exec(rest);
    const p = /^(?:->>|#>>|#>|->|>=|<=|<>|[=><~(),])/.exec(rest);
    const match = s ?? n ?? w ?? p;
    if (!match)
      throw Error(`Unsupported CHECK syntax near ${rest.slice(0, 30)}`);
    out.push({
      kind: s ? "string" : n ? "number" : w ? "word" : "symbol",
      text: match[0],
    });
    at += match[0].length;
  }
  return out;
}
export function compileCheck(source: string): Node {
  const input = tokens(source);
  let at = 0;
  const peek = () => input[at]?.text.toUpperCase();
  const take = (word: string) => {
    if (peek() === word) {
      at++;
      return true;
    }
    return false;
  };
  const need = (word: string) => {
    if (!take(word)) throw Error(`Expected ${word}, got ${peek()}`);
  };
  function or(): Node {
    let a = and();
    while (take("OR")) {
      const l = a,
        r = and();
      a = (row) => sqlOr(l(row), r(row));
    }
    return a;
  }
  function and(): Node {
    let a = not();
    while (take("AND")) {
      const l = a,
        r = not();
      a = (row) => sqlAnd(l(row), r(row));
    }
    return a;
  }
  function not(): Node {
    if (take("NOT")) {
      const a = not();
      return (row) => sqlNot(a(row));
    }
    return comparison();
  }
  function comparison(): Node {
    const a = value();
    if (take("IS")) {
      const negate = take("NOT");
      if (take("DISTINCT")) {
        need("FROM");
        const b = value();
        return (row) =>
          negate
            ? isDeepStrictEqual(a(row) ?? null, b(row) ?? null)
            : !isDeepStrictEqual(a(row) ?? null, b(row) ?? null);
      }
      const word = peek();
      if (!["NULL", "TRUE", "FALSE"].includes(word ?? ""))
        throw Error("Unsupported IS predicate");
      at++;
      return (row) => {
        const v = a(row),
          ok =
            word === "NULL"
              ? v == null
              : word === "TRUE"
                ? v === true
                : v === false;
        return negate ? !ok : ok;
      };
    }
    if (take("IN")) {
      need("(");
      const args = [or()];
      while (take(",")) args.push(or());
      need(")");
      return (row) => {
        const v = a(row),
          vs = args.map((x) => x(row));
        if (v == null) return null;
        if (vs.some((x) => isDeepStrictEqual(v, x))) return true;
        return vs.some((x) => x == null) ? null : false;
      };
    }
    if (take("BETWEEN")) {
      const lo = value();
      need("AND");
      const hi = value();
      return (row) =>
        sqlAnd(compare(">=", a(row), lo(row)), compare("<=", a(row), hi(row)));
    }
    if (["=", "<>", ">", ">=", "<", "<=", "~"].includes(peek() ?? "")) {
      const op = input[at++].text,
        b = value();
      return (row) => compare(op, a(row), b(row));
    }
    return a;
  }
  function value(): Node {
    let a = primary();
    while (["->>", "#>>", "#>", "->"].includes(peek() ?? "")) {
      const op = input[at++].text,
        b = primary(),
        left = a;
      a = (row) => {
        let v = left(row);
        const key = b(row);
        const keys =
          op === "#>>" || op === "#>"
            ? String(key)
                .replace(/^\{|\}$/g, "")
                .split(",")
            : [String(key)];
        for (const part of keys) {
          if (v == null || typeof v !== "object") return null;
          v = (v as Row)[part];
        }
        if (v == null) return null;
        return op === "->" || op === "#>"
          ? v
          : typeof v === "object"
            ? JSON.stringify(v)
            : String(v);
      };
    }
    return a;
  }
  function primary(): Node {
    if (take("(")) {
      const a = or();
      need(")");
      return a;
    }
    const token = input[at++];
    if (!token) throw Error("Unexpected CHECK end");
    if (token.kind === "string") {
      const v = token.text.slice(1, -1).replace(/''/g, "'");
      return () => v;
    }
    if (token.kind === "number") {
      const v = Number(token.text);
      return () => v;
    }
    const word = token.text.toUpperCase();
    if (word === "NULL") return () => null;
    if (word === "TRUE") return () => true;
    if (word === "FALSE") return () => false;
    if (token.kind !== "word") throw Error(`Unexpected CHECK token ${word}`);
    if (take("(")) {
      const args: Node[] = [];
      if (!take(")")) {
        args.push(or());
        while (take(",")) args.push(or());
        need(")");
      }
      return (row) => {
        const vs = args.map((x) => x(row));
        if (word === "COALESCE") return vs.find((x) => x != null) ?? null;
        if (word === "BTRIM")
          return vs[0] == null ? null : String(vs[0]).trim();
        if (word === "LENGTH")
          return vs[0] == null ? null : Array.from(String(vs[0])).length;
        if (word === "JSONB_TYPEOF")
          return vs[0] == null
            ? null
            : Array.isArray(vs[0])
              ? "array"
              : typeof vs[0] === "object"
                ? "object"
                : typeof vs[0];
        if (word === "JSONB_ARRAY_LENGTH") {
          if (!Array.isArray(vs[0]))
            throw Error("Expected synthetic JSON array");
          return vs[0].length;
        }
        throw Error(`Unsupported CHECK function ${word}`);
      };
    }
    return (row) => row[token.text.toLowerCase()] ?? null;
  }
  const result = or();
  if (at !== input.length)
    throw Error(`Unconsumed CHECK tokens near ${peek()}`);
  return result;
}
export function checkExpression(sql: string, name: string): string {
  const marker = `CONSTRAINT ${name} CHECK`;
  const from = sql.indexOf(marker);
  if (from < 0) throw Error(`Missing CHECK ${name}`);
  const start = sql.indexOf("(", from + marker.length);
  let depth = 1,
    quoted = false;
  for (let i = start + 1; i < sql.length; i++) {
    if (sql[i] === "'") {
      if (quoted && sql[i + 1] === "'") {
        i++;
        continue;
      }
      quoted = !quoted;
    }
    if (quoted) continue;
    if (sql[i] === "(") depth++;
    if (sql[i] === ")" && --depth === 0) return sql.slice(start + 1, i);
  }
  throw Error(`Unclosed CHECK ${name}`);
}
export const acceptsCheck = (result: unknown) =>
  result === true || result == null;
