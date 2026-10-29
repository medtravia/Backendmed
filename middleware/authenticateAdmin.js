import { verifyAdminToken } from "../services/authService.js";
import { prisma } from "../services/prisma.js";
import { isUuid } from "../validation/uuid.js";

export async function authenticateAdmin(req, res, next) {
  try {
    const authorization = req.get("authorization") || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const payload = verifyAdminToken(token);
    const adminId = payload.sub;

    if (!isUuid(adminId) || payload.role !== "admin") {
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    const admin = await prisma.admin.findFirst({
      where: { id: adminId, isActive: true },
      select: { id: true, name: true, email: true },
    });

    if (!admin) {
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    req.admin = admin;
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired authentication token" });
    }

    return next(error);
  }
}
