export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "缺少驗證權杖" });
    }

    if (req.user.role !== "SUPER_ADMIN" && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "無權限" });
    }

    return next();
  };
}
