import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ user: null });
    }

    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(
      token,
      env.NEXTAUTH_SECRET_CURRENT || env.NEXTAUTH_SECRET
    ) as { userId: string; email: string; role: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { partnerProfile: true }
    });

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        partnerId: user.partnerProfile?.id,
        clientRating: user.clientRating,
        clientTotalReviews: user.clientTotalReviews,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('[Mobile Auth] Session error:', error);
    return NextResponse.json({ user: null });
  }
}
