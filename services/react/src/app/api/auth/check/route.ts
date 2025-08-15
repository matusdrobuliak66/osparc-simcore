import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://10.43.103.145.nip.io:9081';

export async function GET(request: NextRequest) {
  try {
    // Forward cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    
    const response = await fetch(`${BACKEND_URL}/v0/auth:check`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
    });

    // Return the same status code as the backend
    return new NextResponse(null, {
      status: response.status,
    });
  } catch (error) {
    console.error('Auth check proxy error:', error);
    return new NextResponse(null, {
      status: 401,
    });
  }
}
