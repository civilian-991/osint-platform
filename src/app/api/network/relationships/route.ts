import { NextRequest, NextResponse } from 'next/server';
import { networkIntelligence } from '@/lib/services/network-intelligence';
import type { RelationshipType } from '@/lib/types/network';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const aircraftId = searchParams.get('aircraftId');

    if (!aircraftId) {
      return NextResponse.json(
        { success: false, error: 'aircraftId is required' },
        { status: 400 }
      );
    }

    const relationships = await networkIntelligence.getRelationshipsForAircraft(aircraftId);

    return NextResponse.json({
      success: true,
      data: relationships,
    });
  } catch (error) {
    console.error('Error getting relationships:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get relationships' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      aircraft_id_1,
      aircraft_id_2,
      icao_hex_1,
      icao_hex_2,
      relationship_type,
      confirmed_by,
    } = body;

    if (!aircraft_id_1 || !aircraft_id_2 || !relationship_type || !confirmed_by) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const relationship = await networkIntelligence.createManualRelationship({
      aircraft_id_1,
      aircraft_id_2,
      icao_hex_1,
      icao_hex_2,
      relationship_type: relationship_type as RelationshipType,
      confirmed_by,
    });

    if (relationship) {
      return NextResponse.json({
        success: true,
        data: relationship,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create relationship' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error creating relationship:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create relationship' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const relationshipId = searchParams.get('id');

    if (!relationshipId) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const deleted = await networkIntelligence.deleteRelationship(relationshipId);

    return NextResponse.json({
      success: deleted,
      message: deleted ? 'Relationship deleted' : 'Failed to delete',
    });
  } catch (error) {
    console.error('Error deleting relationship:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete relationship' },
      { status: 500 }
    );
  }
}
