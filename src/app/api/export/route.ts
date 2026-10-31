import { NextResponse } from "next/server";
import { getSession } from "@/server/auth";
import { exportUserData } from "@/server/repo/user";

/** GDPR data portability: download everything stored for this user. */
export async function GET() {
  const { userId } = await getSession();
  return new NextResponse(JSON.stringify(await exportUserData(userId), null, 2), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="macromap-export.json"' },
  });
}
