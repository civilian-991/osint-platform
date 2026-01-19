import { NextRequest, NextResponse } from 'next/server';
import { networkGraphService } from '@/lib/services/network-graph';
import { networkIntelligence } from '@/lib/services/network-intelligence';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: aircraftId } = await params;
    const { searchParams } = new URL(request.url);
    const maxNodes = parseInt(searchParams.get('maxNodes') || '50', 10);

    const [graph, centrality, relationships, cooccurrences] = await Promise.all([
      networkGraphService.generateNetworkGraph({
        scope: 'ego',
        aircraft_id: aircraftId,
        max_nodes: maxNodes,
      }),
      networkGraphService.calculateCentrality(aircraftId),
      networkIntelligence.getRelationshipsForAircraft(aircraftId),
      networkIntelligence.getCooccurrencesForAircraft(aircraftId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        graph,
        centrality,
        relationships,
        cooccurrences,
      },
    });
  } catch (error) {
    console.error('Error getting aircraft network:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get aircraft network' },
      { status: 500 }
    );
  }
}
