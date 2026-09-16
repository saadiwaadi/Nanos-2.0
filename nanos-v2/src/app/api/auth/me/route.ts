import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "nanos-secret-key-2026";
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header." } },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7).trim();
    let payload;
    try {
      const verified = await jwtVerify(token, secretKey);
      payload = verified.payload;
    } catch {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired token." } },
        { status: 401 }
      );
    }

    const userId = payload.sub as string;
    if (!userId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid token payload." } },
        { status: 401 }
      );
    }

    let userRow = null;
    try {
      userRow = await prisma.user.findUnique({ where: { id: userId } });
    } catch {
      // DB offline fallback
    }

    if (userRow) {
      return NextResponse.json({
        user: {
          id: userRow.id,
          name: userRow.name || "Customer",
          email: userRow.email,
          role: userRow.role,
        },
      });
    }

    return NextResponse.json({
      user: {
        id: userId,
        name: "Customer",
        email: "user@nanos.pk",
        role: (payload.role as string) || "customer",
      },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to fetch user session." } },
      { status: 500 }
    );
  }
}
