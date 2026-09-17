import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; colorId: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { colorId } = await params;

  try {
    const body = await request.json();
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.hex !== undefined) updateData.hex = body.hex;
    if (body.images !== undefined) {
      updateData.imagesJson = JSON.stringify(Array.isArray(body.images) ? body.images : []);
    }
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder);

    const updatedColor = await prisma.productColor.update({
      where: { id: colorId },
      data: updateData,
    });

    return NextResponse.json(updatedColor);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update product color" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; colorId: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { colorId } = await params;

  try {
    await prisma.productColor.delete({
      where: { id: colorId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete product color" },
      { status: 500 }
    );
  }
}
