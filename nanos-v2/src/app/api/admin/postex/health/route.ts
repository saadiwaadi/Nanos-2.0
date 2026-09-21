import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { postexFetch } from "@/lib/postex-client";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const len = (process.env.POSTEX_API_TOKEN ?? "").trim().length;
  try {
    const r: any = await postexFetch("/order/v1/get-merchant-address");
    const addressList = (r?.dist ?? []).map(
      (a: any) => a.pickupAddressCode || a.addressCode || a.code
    );
    return NextResponse.json({
      ok: true,
      tokenLength: len,
      addresses: addressList,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      code: e.code || "ERROR",
      message: e.message || "Failed to reach PostEx API",
      tokenLength: len,
    });
  }
}
