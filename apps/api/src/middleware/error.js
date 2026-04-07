export function notFound(req, res) {
  res.status(404).json({ message: "找不到資源" });
}

export function errorHandler(error, req, res, next) {
  console.error(error);
  res.status(500).json({
    message: error?.message || "伺服器內部錯誤"
  });
}
