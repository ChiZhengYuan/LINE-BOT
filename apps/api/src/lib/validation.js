import { z } from "zod";

export function parseBody(schema, req, res) {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
  const message = result.error.issues[0]?.message || "無效的請求";
    res.status(400).json({ message });
    return null;
  }

  return result.data;
}

export function datetimeInput() {
  return z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string") {
      return new Date(value);
    }

    return value;
  }, z.date().optional().nullable());
}

export function parseQuery(schema, req, res) {
  const result = schema.safeParse(req.query ?? {});
  if (!result.success) {
  const message = result.error.issues[0]?.message || "無效的請求";
    res.status(400).json({ message });
    return null;
  }

  return result.data;
}
