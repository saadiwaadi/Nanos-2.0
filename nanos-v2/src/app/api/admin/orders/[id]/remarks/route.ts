import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { callSaveShipperAdviceApi, callGetShipperAdviceApi } from "@/lib/postex";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<number, string> = {
  0: "General Remarks",
  1: "Mark Return Requested",
  2: "Mark Retry Attempt",
};

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { id } = await ctx.params;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        auditLogs: {
          where: {
            action: { in: ["SHIPPER_ADVICE", "ADD_REMARK", "NOTES_UPDATED"] },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const trackingNumber = order.postexTrackingNumber || order.trackingNumber || null;
    let postexRemarks: any[] = [];

    if (trackingNumber) {
      try {
        const postexRes = await callGetShipperAdviceApi(trackingNumber);
        if (postexRes && postexRes.dist && postexRes.dist.length > 0) {
          const firstDist = postexRes.dist[0];
          if (Array.isArray(firstDist.trackingResponse)) {
            postexRemarks = firstDist.trackingResponse;
          }
        }
      } catch (err: any) {
        console.warn(`[PostEx Shipper Advice GET] Failed for ${trackingNumber}:`, err.message);
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      trackingNumber,
      orderNotes: order.notes,
      localRemarks: order.auditLogs || [],
      postexRemarks,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch remarks" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { id } = await ctx.params;
  const adminEmail = (auth as { userId: string }).userId || "admin";

  try {
    const body = await request.json();
    const { remarks, statusId = 0, syncToPostex = true } = body || {};

    if (!remarks || typeof remarks !== "string" || !remarks.trim()) {
      return NextResponse.json(
        { error: "Remarks text is required." },
        { status: 400 }
      );
    }

    const trimmedRemarks = remarks.trim();
    const parsedStatusId = Number(statusId) || 0;
    const statusLabel = STATUS_LABELS[parsedStatusId] || "Remark";

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const trackingNumber = order.postexTrackingNumber || order.trackingNumber || null;
    let postexSynced = false;
    let postexError: string | null = null;

    if (syncToPostex && trackingNumber) {
      try {
        await callSaveShipperAdviceApi({
          trackingNumber,
          statusId: parsedStatusId,
          remarks: trimmedRemarks,
        });
        postexSynced = true;
      } catch (err: any) {
        postexError = err.message || "PostEx Shipper Advice API error";
        console.error(`[PostEx Save Shipper Advice] Failed:`, postexError);
      }
    }

    // Save remark to Audit Log & Event in database
    const logNote = `[${statusLabel}] ${trimmedRemarks}${
      postexSynced ? " (Synced to PostEx)" : postexError ? ` (PostEx sync failed: ${postexError})` : ""
    }`;

    await prisma.$transaction([
      prisma.orderAuditLog.create({
        data: {
          orderId: order.id,
          action: "SHIPPER_ADVICE",
          adminUser: adminEmail,
          note: logNote,
        },
      }),
      prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "shipper_advice",
          actor: adminEmail,
          reason: trimmedRemarks,
          metadata: {
            statusId: parsedStatusId,
            statusLabel,
            trackingNumber,
            postexSynced,
            postexError,
          },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: postexSynced
        ? `Remark saved and synced to PostEx successfully.`
        : postexError
        ? `Remark saved locally (PostEx note: ${postexError}).`
        : `Remark saved locally.`,
      postexSynced,
      postexError,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save remark" },
      { status: 500 }
    );
  }
}
