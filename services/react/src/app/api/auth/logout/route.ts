import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://10.43.103.145.nip.io:9081';

export async function POST(request: NextRequest) {
  try {
    // Forward cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    
    const response = await fetch(`${BACKEND_URL}/v0/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
    });

    const data = await response.json();

    // Create response and clear cookies
    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });

    // Clear authentication cookies
    nextResponse.cookies.set('osparc_session', '', {
      expires: new Date(0),
      path: '/',
    });

    return nextResponse;
  } catch (error) {
    console.error('Logout proxy error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
