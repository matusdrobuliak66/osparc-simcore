import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://10.43.103.145.nip.io:9081';

export async function GET(request: NextRequest) {
  try {
    // Forward cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    
    const response = await fetch(`${BACKEND_URL}/v0/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error('User profile proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
