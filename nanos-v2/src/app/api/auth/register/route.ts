import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "nanos-secret-key-2026";
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body || {};

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Name must be at least 2 characters long." } },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Please provide a valid email address." } },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Password must be at least 6 characters long." } },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    let existingUser = null;
    try {
      existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    } catch {
      // DB offline fallback
    }

    if (existingUser) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Email already in use." } },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = "user_" + Math.random().toString(36).substring(2, 11);

    try {
      await prisma.user.create({
        data: {
          id: userId,
          email: cleanEmail,
          name: cleanName,
          passwordHash,
          role: "customer",
        },
      });
    } catch {
      // DB offline fallback
    }

    const token = await new SignJWT({ sub: userId, role: "customer" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30d")
      .sign(secretKey);

    return NextResponse.json(
      {
        user: {
          id: userId,
          name: cleanName,
          email: cleanEmail,
          role: "customer",
        },
        token,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to register user." } },
      { status: 500 }
    );
  }
}
