export function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Missing token" });
  }

  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  return next();
}

export function getTenantOwnerId(req) {
  if (!req.user || req.user.role === "SUPER_ADMIN") {
    return null;
  }

  return req.user.sub;
}

export function applyTenantWhere(req, where = {}) {
  const ownerAdminId = getTenantOwnerId(req);
  if (!ownerAdminId) {
    return where;
  }

  return {
    ...where,
    ownerAdminId
  };
}

export function applyTenantGroupWhere(req, where = {}) {
  const ownerAdminId = getTenantOwnerId(req);
  if (!ownerAdminId) {
    return where;
  }

  return {
    ...where,
    group: {
      ...(where.group || {}),
      ownerAdminId
    }
  };
}

export function ensureTenantOwnerId(req) {
  const ownerAdminId = getTenantOwnerId(req);
  return ownerAdminId || null;
}
