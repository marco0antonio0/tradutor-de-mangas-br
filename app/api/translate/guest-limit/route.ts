import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    allowed: true,
    remaining: 999999,
    used: 0,
    limit: 999999,
  })
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    allowed: true,
    remaining: 999999,
    used: 0,
    limit: 999999,
  })
}
