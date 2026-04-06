export function notFound(req, res) {
  res.status(404).json({ message: "Not found" });
}

export function errorHandler(error, req, res, next) {
  console.error(error);
  res.status(500).json({
    message: error?.message || "Internal server error"
  });
}
