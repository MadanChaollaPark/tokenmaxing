import { NextRequest } from "next/server";

export async function readJsonBody(request: NextRequest, maxBytes: number) {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new PayloadTooLargeError();
  }
  return JSON.parse(text);
}

export class PayloadTooLargeError extends Error {
  constructor() {
    super("payload too large");
    this.name = "PayloadTooLargeError";
  }
}
