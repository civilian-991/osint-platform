import { NextRequest, NextResponse } from 'next/server';
import { metricsService } from '@/lib/services/metrics-service';
import type { TrendPeriod, MetricScope } from '@/lib/types/dashboard';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const metricsParam = searchParams.get('metrics') || 'total_aircraft,formations_detected';
    const metrics = metricsParam.split(',');
    const period = (searchParams.get('period') as TrendPeriod) || '7d';
    const scope = (searchParams.get('scope') as MetricScope) || 'global';
    const scopeValue = searchParams.get('scopeValue') || undefined;

    const trends = await metricsService.getTrendData(metrics, period, scope, scopeValue);

    return NextResponse.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('Error getting trends:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get trends' },
      { status: 500 }
    );
  }
}
