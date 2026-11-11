import { NextResponse } from 'next/server';

export function guardWrite(request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  try {
    if (!origin || new URL(origin).host !== host) throw new Error();
  } catch {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }
  return null;
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function jsonError(error) {
  return NextResponse.json({ error: error.message || 'Request failed' }, { status: error.status || 500 });
}
