import { HTTP_METHODS, type HttpMethod } from "./types";

export type { HttpMethod };

export function parseHttpMethod(method: string): HttpMethod | null {
  const upper = method.toUpperCase();
  for (const verb of HTTP_METHODS) {
    if (verb === upper) return verb;
  }
  return null;
}

export function isMethod(method: string, expected: HttpMethod): boolean {
  return parseHttpMethod(method) === expected;
}
