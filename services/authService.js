import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getJwtConfig } from "../config/env.js";
import { prisma } from "./prisma.js";

const dummyPasswordHash = "$2b$12$ci1owup95BIluYriG1x01u7dYUGC5Af.eV2wk.iRAlLwVmHZQL3im";

export async function loginAdmin(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const admin = await prisma.admin.findUnique({
    where: { email: normalizedEmail },
  });

  const passwordMatches = await bcrypt.compare(
    password,
    admin?.passwordHash || dummyPasswordHash,
  );

  if (!admin || !admin.isActive || !passwordMatches) {
    return null;
  }

  const jwtConfig = getJwtConfig();
  const token = jwt.sign(
    { role: "admin" },
    jwtConfig.secret,
    {
      algorithm: "HS256",
      audience: jwtConfig.audience,
      issuer: jwtConfig.issuer,
      subject: String(admin.id),
      expiresIn: jwtConfig.expiresIn,
    },
  );

  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    token,
    expiresIn: jwtConfig.expiresIn,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
    },
  };
}

export function verifyAdminToken(token) {
  const jwtConfig = getJwtConfig();

  return jwt.verify(token, jwtConfig.secret, {
    algorithms: ["HS256"],
    audience: jwtConfig.audience,
    issuer: jwtConfig.issuer,
  });
}
