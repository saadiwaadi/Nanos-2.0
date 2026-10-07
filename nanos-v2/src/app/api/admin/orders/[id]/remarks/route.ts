import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { callSaveShipperAdviceApi, callGetShipperAdviceApi } from "@/lib/postex";

export const dynamic = "force-dynamic";

// ─── ERROR INDEX DICTIONARY ───────────────────────────────────────────
export interface ErrorIndexDetail {
  code: string;
  category: "AUTH" | "VALIDATION" | "DATABASE" | "POSTEX_LIFECYCLE" | "POSTEX_API" | "SYSTEM";
  severity: "info" | "warning" | "error";
  title: string;
  message: string;
  resolution: string;
}

export const REMARKS_ERROR_INDEX: Record<string, ErrorIndexDetail> = {
  ERR_AUTH_REQUIRED: {
    code: "ERR_AUTH_REQUIRED",
    category: "AUTH",
    severity: "error",
    title: "Authentication Required",
    message: "Admin session is missing or unauthorized.",
    resolution: "Please sign in again to your admin account.",
  },
  ERR_ORDER_NOT_FOUND: {
    code: "ERR_ORDER_NOT_FOUND",
    category: "DATABASE",
    severity: "error",
    title: "Order Not Found",
    message: "The requested order does not exist in the database.",
    resolution: "Refresh the orders table to ensure this order still exists.",
  },
  ERR_EMPTY_REMARK: {
    code: "ERR_EMPTY_REMARK",
    category: "VALIDATION",
    severity: "warning",
    title: "Empty Remark Text",
    message: "Remarks and customer notes cannot be empty.",
    resolution: "Please type a remark or instruction before submitting.",
  },
  ERR_INVALID_STATUS_ID: {
    code: "ERR_INVALID_STATUS_ID",
    category: "VALIDATION",
    severity: "info",
    title: "General Note Stored Internally",
    message: "PostEx courier API only accepts courier advice for Mark Return (1) or Retry Attempt (2).",
    resolution: "This general note has been safely saved in your internal order history and will not be dispatched to the courier.",
  },
  ERR_ORDER_NOT_ELIGIBLE: {
    code: "ERR_ORDER_NOT_ELIGIBLE",
    category: "POSTEX_LIFECYCLE",
    severity: "warning",
    title: "Order Not Eligible For Courier Advice",
    message: "Cancelled orders cannot receive PostEx courier shipper advice.",
    resolution: "Remark saved to internal order notes.",
  },
  ERR_POSTEX_NOT_ATTEMPTED: {
    code: "ERR_POSTEX_NOT_ATTEMPTED",
    category: "POSTEX_LIFECYCLE",
    severity: "info",
    title: "Courier Advice Not Active Yet",
    message: "PostEx requires parcels to have a recorded delivery attempt before accepting rider shipper advice.",
    resolution: "The remark has been saved to your internal order notes. Once the courier attempts delivery, shipper advice can be submitted.",
  },
  ERR_POSTEX_NOT_BOOKED: {
    code: "ERR_POSTEX_NOT_BOOKED",
    category: "POSTEX_LIFECYCLE",
    severity: "info",
    title: "Order Not Booked with PostEx",
    message: "This order does not have an active PostEx tracking number.",
    resolution: "Remark saved to internal order notes. Book the order with PostEx first if you want to sync courier remarks.",
  },
  ERR_POSTEX_AUTH_FAILED: {
    code: "ERR_POSTEX_AUTH_FAILED",
    category: "POSTEX_API",
    severity: "error",
    title: "PostEx Authentication Error",
    message: "PostEx API token is missing, expired, or invalid.",
    resolution: "Check the POSTEX_API_TOKEN configuration in server settings.",
  },
  ERR_POSTEX_API_ERROR: {
    code: "ERR_POSTEX_API_ERROR",
    category: "POSTEX_API",
    severity: "warning",
    title: "PostEx Courier API Notice",
    message: "PostEx could not process shipper advice at this moment.",
    resolution: "The remark is safely saved to the order. Retry submitting to PostEx when courier status updates.",
  },
  ERR_SERVER_EXCEPTION: {
    code: "ERR_SERVER_EXCEPTION",
    category: "SYSTEM",
    severity: "error",
    title: "Internal Server Error",
    message: "An unexpected error occurred while processing the remark.",
    resolution: "Check server logs or try again.",
  },
};

function classifyPostexError(errMsg: string | null | undefined): ErrorIndexDetail {
  const lower = (errMsg || "").toLowerCase();
  if (
    lower.includes("cannot add transaction remark") ||
    lower.includes("check the status of your order") ||
    lower.includes("unbooked") ||
    lower.includes("attempt")
  ) {
    return REMARKS_ERROR_INDEX.ERR_POSTEX_NOT_ATTEMPTED;
  }
  if (lower.includes("token") || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return REMARKS_ERROR_INDEX.ERR_POSTEX_AUTH_FAILED;
  }
  if (lower.includes("not found") || lower.includes("invalid tracking")) {
    return REMARKS_ERROR_INDEX.ERR_POSTEX_NOT_BOOKED;
  }
  return {
    ...REMARKS_ERROR_INDEX.ERR_POSTEX_API_ERROR,
    message: errMsg || REMARKS_ERROR_INDEX.ERR_POSTEX_API_ERROR.message,
  };
}

const STATUS_LABELS: Record<number, string> = {
  0: "Internal Note",
  1: "Return Requested",
  2: "Delivery Reattempt",
};

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json(
      { ok: false, error: "Unauthorized", errorIndex: REMARKS_ERROR_INDEX.ERR_AUTH_REQUIRED },
      { status }
    );
  }

  const { id } = await ctx.params;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        auditLogs: {
          where: {
            action: { in: ["SHIPPER_ADVICE", "ADD_REMARK", "NOTES_UPDATED", "INTERNAL_NOTE"] },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Order not found", errorIndex: REMARKS_ERROR_INDEX.ERR_ORDER_NOT_FOUND },
        { status: 404 }
      );
    }

    const trackingNumber = order.postexTrackingNumber || order.trackingNumber || null;
    let postexRemarks: any[] = [];

    if (trackingNumber) {
      try {
        const postexRes = await callGetShipperAdviceApi(trackingNumber);
        if (postexRes && postexRes.dist) {
          if (Array.isArray(postexRes.dist)) {
            for (const item of postexRes.dist) {
              if (Array.isArray(item.trackingResponse)) {
                postexRemarks.push(...item.trackingResponse);
              } else if ((item as any).remarks) {
                postexRemarks.push(item);
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`[PostEx Shipper Advice GET] Notice for ${trackingNumber}:`, err.message);
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      trackingNumber,
      orderNotes: order.notes || "",
      localRemarks: order.auditLogs || [],
      postexRemarks,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Failed to fetch remarks",
        errorIndex: REMARKS_ERROR_INDEX.ERR_SERVER_EXCEPTION,
      },
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
    return NextResponse.json(
      { ok: false, error: "Unauthorized", errorIndex: REMARKS_ERROR_INDEX.ERR_AUTH_REQUIRED },
      { status }
    );
  }

  const { id } = await ctx.params;
  const adminEmail = (auth as { userId: string }).userId || "admin";

  try {
    const body = await request.json();
    const { remarks, statusId = 0, syncToPostex = false } = body || {};

    if (!remarks || typeof remarks !== "string" || !remarks.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Remarks text is required.",
          errorIndex: REMARKS_ERROR_INDEX.ERR_EMPTY_REMARK,
        },
        { status: 400 }
      );
    }

    const trimmedRemarks = remarks.trim();
    const parsedStatusId = Number(statusId) || 0;
    const isPostexAdviceType = parsedStatusId === 1 || parsedStatusId === 2;
    const statusLabel = STATUS_LABELS[parsedStatusId] || "Internal Note";

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Order not found", errorIndex: REMARKS_ERROR_INDEX.ERR_ORDER_NOT_FOUND },
        { status: 404 }
      );
    }

    const trackingNumber = order.postexTrackingNumber || order.trackingNumber || null;
    let postexSynced = false;
    let postexErrorIndex: ErrorIndexDetail | null = null;
    let rawPostexError: string | null = null;

    // Upfront Guards for PostEx Shipper Advice:
    // 1. PostEx ONLY supports statusId 1 (Return Requested) or 2 (Retry Attempt)
    // 2. General/Internal notes (statusId 0) must stay local only
    // 3. Order must be active and have a tracking number
    if (syncToPostex) {
      if (!isPostexAdviceType) {
        postexErrorIndex = REMARKS_ERROR_INDEX.ERR_INVALID_STATUS_ID;
      } else if (!trackingNumber) {
        postexErrorIndex = REMARKS_ERROR_INDEX.ERR_POSTEX_NOT_BOOKED;
      } else if (order.status === "cancelled" || order.orderStatus === "CANCELLED") {
        postexErrorIndex = REMARKS_ERROR_INDEX.ERR_ORDER_NOT_ELIGIBLE;
      } else {
        try {
          await callSaveShipperAdviceApi({
            trackingNumber,
            statusId: parsedStatusId as 1 | 2,
            remarks: trimmedRemarks,
          });
          postexSynced = true;
        } catch (err: any) {
          console.error(`[POSTEX_DIAG] Full caught error:`, JSON.stringify(err, Object.getOwnPropertyNames(err)));
          rawPostexError = err.message || "PostEx Shipper Advice API error";
          postexErrorIndex = classifyPostexError(rawPostexError);
          console.warn(`[PostEx Save Shipper Advice] Failed for ${trackingNumber}:`, {
            error: rawPostexError,
            responseBody: err.responseBody || null,
          });
        }
      }
    }

    // Prepare note content for audit log
    const auditAction = postexSynced ? "SHIPPER_ADVICE" : "ADD_REMARK";
    const logNote = postexSynced
      ? `[PostEx Shipper Advice: ${statusLabel}] ${trimmedRemarks}`
      : `[${statusLabel}] ${trimmedRemarks}`;

    // Execute atomic update: update order.notes and create audit logs
    const [newAuditLog, updatedOrder] = await prisma.$transaction([
      prisma.orderAuditLog.create({
        data: {
          orderId: order.id,
          action: auditAction,
          adminUser: adminEmail,
          note: logNote,
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          notes: trimmedRemarks,
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
            trackingNumber: trackingNumber || "",
            postexSynced,
            postexError: rawPostexError || "",
            errorIndexCode: postexErrorIndex?.code || "",
          },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: postexSynced
        ? `Remark saved and synced to PostEx successfully.`
        : postexErrorIndex
        ? `Remark saved internally. (${postexErrorIndex.title}: ${postexErrorIndex.resolution})`
        : `Remark saved successfully as order note.`,
      postexSynced,
      errorIndex: postexErrorIndex,
      auditLog: newAuditLog,
      orderNotes: updatedOrder.notes,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Failed to save remark",
        errorIndex: REMARKS_ERROR_INDEX.ERR_SERVER_EXCEPTION,
      },
      { status: 500 }
    );
  }
}
