import { NextRequest, NextResponse } from 'next/server';
import { networkGraphService } from '@/lib/services/network-graph';
import type { NetworkScope } from '@/lib/types/network';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get('scope') as NetworkScope) || 'global';
    const operatorId = searchParams.get('operatorId') || undefined;
    const region = searchParams.get('region') || undefined;
    const minCooccurrence = parseInt(searchParams.get('minCooccurrence') || '2', 10);
    const maxNodes = parseInt(searchParams.get('maxNodes') || '100', 10);

    const graph = await networkGraphService.generateNetworkGraph({
      scope,
      operator_id: operatorId,
      region,
      min_cooccurrence: minCooccurrence,
      max_nodes: maxNodes,
    });

    return NextResponse.json({
      success: true,
      data: graph,
    });
  } catch (error) {
    console.error('Error generating network graph:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate graph' },
      { status: 500 }
    );
  }
}
