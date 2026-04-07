export function parseBody(schema, req, res) {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const message = result.error.issues[0]?.message || "Invalid request";
    res.status(400).json({ message });
    return null;
  }

  return result.data;
}

export function parseQuery(schema, req, res) {
  const result = schema.safeParse(req.query ?? {});
  if (!result.success) {
    const message = result.error.issues[0]?.message || "Invalid request";
    res.status(400).json({ message });
    return null;
  }

  return result.data;
}
