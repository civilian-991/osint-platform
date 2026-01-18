import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query, execute } from '@/lib/db';
import { nlpEnhancer } from '@/lib/services/nlp-enhancer';
import { embeddingService } from '@/lib/services/embedding-service';
import { intelligenceEngine } from '@/lib/services/intelligence-engine';
import { behavioralProfiler } from '@/lib/services/behavioral-profiler';
import { formationDetector } from '@/lib/services/formation-detector';
import type { MLTask, MLTaskType, PositionData } from '@/lib/types/ml';

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  if (!cronSecret) {
    console.warn('CRON_SECRET not set');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// Configuration
const CONFIG = {
  maxTasksPerRun: 10,
  taskTimeout: 30000, // 30 seconds per task
};

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check if ML processing is enabled
  if (process.env.ENABLE_ML_PROCESSING !== 'true') {
    return NextResponse.json({
      success: true,
      message: 'ML processing is disabled',
      processed: 0,
    });
  }

  try {
    let processedCount = 0;
    let errorCount = 0;
    const results: Array<{ taskId: string; taskType: string; success: boolean; error?: string }> = [];

    // Process tasks up to the limit
    for (let i = 0; i < CONFIG.maxTasksPerRun; i++) {
      // Get next task from queue
      const taskResult = await queryOne<{
        id: string;
        task_type: MLTaskType;
        entity_type: string;
        entity_id: string;
        payload: Record<string, unknown>;
        priority: number;
        attempts: number;
      }>(`SELECT * FROM get_next_ml_task()`);

      if (!taskResult) {
        // No more tasks to process
        break;
      }

      const task = taskResult;
      let success = false;
      let error: string | undefined;

      try {
        // Process task based on type
        success = await processTask(task);
      } catch (taskError) {
        error = taskError instanceof Error ? taskError.message : 'Unknown error';
        console.error(`Error processing task ${task.id}:`, taskError);
      }

      // Complete the task
      await execute(`SELECT complete_ml_task($1, $2, $3)`, [
        task.id,
        success,
        error || null,
      ]);

      results.push({
        taskId: task.id,
        taskType: task.task_type,
        success,
        error,
      });

      if (success) {
        processedCount++;
      } else {
        errorCount++;
      }
    }

    // Also run formation detection periodically
    try {
      const formations = await formationDetector.detectFormations();
      const deactivated = await formationDetector.deactivateStaleFormations();
      results.push({
        taskId: 'formation_detection',
        taskType: 'formation_detection',
        success: true,
      });
    } catch (formationError) {
      console.error('Error in formation detection:', formationError);
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} tasks, ${errorCount} errors`,
      stats: {
        processed: processedCount,
        errors: errorCount,
        results,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in process-ml-queue cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function processTask(task: {
  id: string;
  task_type: MLTaskType;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
}): Promise<boolean> {
  switch (task.task_type) {
    case 'entity_extraction':
      return processEntityExtraction(task.entity_id);

    case 'embedding_generation':
      return processEmbeddingGeneration(task.entity_type, task.entity_id, task.payload);

    case 'anomaly_detection':
      return processAnomalyDetection(task.entity_id, task.payload);

    case 'intent_classification':
      return processIntentClassification(task.entity_id, task.payload);

    case 'threat_assessment':
      return processThreatAssessment(task.entity_type, task.entity_id, task.payload);

    case 'profile_update':
      return processProfileUpdate(task.entity_id, task.payload);

    case 'corroboration_scoring':
      return processCorroborationScoring(task.entity_id);

    default:
      console.warn(`Unknown task type: ${task.task_type}`);
      return false;
  }
}

async function processEntityExtraction(newsEventId: string): Promise<boolean> {
  const count = await nlpEnhancer.processNewsEvent(newsEventId);
  return count >= 0;
}

async function processEmbeddingGeneration(
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const text = payload.text as string;
  if (!text) {
    return false;
  }

  const embedding = await embeddingService.generateAndStoreEmbedding(
    entityType as 'news_event' | 'aircraft' | 'correlation',
    entityId,
    text,
    payload.metadata as Record<string, unknown>
  );

  return embedding !== null;
}

async function processAnomalyDetection(
  aircraftId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const positions = payload.positions as PositionData[] | undefined;
  if (!positions || positions.length < 2) {
    return false;
  }

  const flightId = payload.flight_id as string | undefined;
  const pattern = payload.pattern as string | undefined;

  const anomalies = await intelligenceEngine.detectAnomalies(
    aircraftId,
    flightId || null,
    positions,
    pattern
  );

  return true; // Even if no anomalies detected, task completed successfully
}

async function processIntentClassification(
  aircraftId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const positions = payload.positions as PositionData[] | undefined;
  if (!positions || positions.length < 2) {
    return false;
  }

  // Get aircraft info
  const aircraft = await queryOne<{
    type_code: string | null;
    military_category: string | null;
  }>(`SELECT type_code, military_category FROM aircraft WHERE id = $1`, [aircraftId]);

  const classification = await intelligenceEngine.classifyIntent(
    aircraftId,
    payload.flight_id as string | null,
    aircraft?.type_code || null,
    aircraft?.military_category as import('@/lib/types/aircraft').MilitaryCategory | null,
    payload.pattern as string | null,
    positions,
    payload.nearby_aircraft as import('@/lib/types/ml').NearbyAircraft[] | undefined
  );

  return classification !== null;
}

async function processThreatAssessment(
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const assessment = await intelligenceEngine.assessThreat(
    entityType as 'aircraft' | 'region' | 'news_event' | 'correlation',
    entityId,
    payload
  );

  return assessment !== null;
}

async function processProfileUpdate(
  aircraftId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const positions = payload.positions as PositionData[] | undefined;
  if (!positions || positions.length < 2) {
    return false;
  }

  return behavioralProfiler.updateProfile({
    aircraft_id: aircraftId,
    pattern: payload.pattern as string | undefined,
    positions,
    flight_time: payload.flight_time as { departure: string; arrival?: string } | undefined,
  });
}

async function processCorroborationScoring(newsEventId: string): Promise<boolean> {
  const success = await nlpEnhancer.processNewsEventEmbedding(newsEventId);
  return success;
}

// Support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}
