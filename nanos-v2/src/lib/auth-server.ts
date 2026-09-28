import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "nanos-secret-key-2026";
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function verifyToken(
  request: Request
): Promise<{ sub: string; role: string } | null> {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7).trim();
    let payload: any = null;

    try {
      const verified = await jwtVerify(token, secretKey);
      payload = verified.payload;
    } catch {
      if (process.env.ADMIN_JWT_SECRET) {
        try {
          const adminKey = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET);
          const verified = await jwtVerify(token, adminKey);
          payload = verified.payload;
        } catch {
          // invalid
        }
      }
    }

    if (!payload || !payload.sub || typeof payload.sub !== "string") {
      return null;
    }

    return {
      sub: payload.sub,
      role: typeof payload.role === "string" ? payload.role : "customer",
    };
  } catch {
    return null;
  }
}

export async function requireAdmin(
  request: Request
): Promise<{ userId: string } | { error: string }> {
  const payload = await verifyToken(request);
  if (!payload) return { error: "401" };
  const roleUpper = (payload.role || "").toUpperCase();
  if (roleUpper !== "ADMIN") return { error: "403" };
  return { userId: payload.sub };
}

