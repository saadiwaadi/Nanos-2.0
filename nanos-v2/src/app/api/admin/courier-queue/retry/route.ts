import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { bookOne } from "@/lib/postex-booking";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const body = await request.json();
    const { orderId } = body || {};

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    const adminEmail = (auth as { userId: string }).userId || "admin:manual";
    const res = await bookOne(orderId, adminEmail);

    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Retry failed" },
      { status: 500 }
    );
  }
}
