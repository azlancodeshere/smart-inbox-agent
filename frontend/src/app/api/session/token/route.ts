import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Returns the raw Auth.js session JWT so the client can forward it to the
 * Express API as `Authorization: Bearer <token>`.
 */
export async function GET() {
  const store = await cookies();
  const token = store
    .getAll()
    .find((c) => c.name.endsWith("session-token"))?.value;

  if (!token) {
    return NextResponse.json({ token: null }, { status: 401 });
  }

  return NextResponse.json({ token });
}
