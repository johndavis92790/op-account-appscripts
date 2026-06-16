/**
 * Task Creator Webhook Handler
 * Handles create_task and close_task webhooks
 * Replaces WebhookHandler.js processCreateTaskWebhook() and processCloseTaskWebhook()
 */

import * as functions from 'firebase-functions';
import { z } from 'zod';
import * as firestore from '../firestore';
import { secrets } from '../config';
import type { Task } from '../types';
import { db } from '../firestore';

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  priority: z.string().optional(),
  accountName: z.string().optional(),
  accountId: z.string().optional(),
  createdBy: z.string().optional(),
});

const CloseTaskSchema = z.object({
  issueNumber: z.number(),
});

// =============================================================================
// Create Task Handler
// =============================================================================

export const createTaskFromWebhook = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    // Validate webhook secret
    const authHeader = req.headers.authorization || '';
    if (secrets.WEBHOOK_SECRET && !authHeader.includes(secrets.WEBHOOK_SECRET)) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const payload = CreateTaskSchema.parse(req.body);

    if (!payload.title) {
      res.status(400).json({ success: false, error: 'Missing required field: title' });
      return;
    }

    const taskId = db.collection('tasks').doc().id;
    const now = new Date().toISOString();

    // Normalize priority
    let priority: 'critical' | 'high' | 'medium' | 'low' | null = null;
    const rawPriority = (payload.priority || '').toLowerCase();
    if (rawPriority.includes('high')) priority = 'high';
    else if (rawPriority.includes('medium')) priority = 'medium';
    else if (rawPriority.includes('low')) priority = 'low';

    const task: Task = {
      taskId,
      title: String(payload.title).trim().substring(0, 200),
      description: payload.description || '',
      status: 'backlog',
      priority,
      targetDate: null,
      accountId: payload.accountId || null,
      accountName: payload.accountName || null,
      parentTaskId: null,
      assigneeIds: [],
      labelIds: [],
      source: 'manual',
      sourceRef: {
        manuallyCreatedBy: payload.createdBy || 'webhook',
      },
      createdAt: now,
      updatedAt: now,
      closedAt: null,
      createdBy: payload.createdBy || 'webhook',
    };

    await firestore.createTask(task);

    // Add activity log
    await firestore.addTaskActivity(taskId, {
      activityId: db.collection('tasks').doc().id,
      type: 'created',
      actorId: payload.createdBy || 'webhook',
      timestamp: now,
      detail: { note: 'Created via webhook' },
    });

    console.log(`✓ Created task ${taskId}: ${task.title}`);

    res.json({
      success: true,
      action: 'created',
      taskId: taskId,
      // Legacy compatibility - return placeholders for old TaskPanel
      issueNodeId: taskId,
      issueNumber: 0,
      issueUrl: '',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('ERROR in createTaskFromWebhook:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: errorMessage,
    });
  }
});

// =============================================================================
// Close Task Handler (Legacy - for GitHub compatibility)
// =============================================================================

export const closeTaskFromWebhook = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    // Validate webhook secret
    const authHeader = req.headers.authorization || '';
    if (secrets.WEBHOOK_SECRET && !authHeader.includes(secrets.WEBHOOK_SECRET)) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const payload = CloseTaskSchema.parse(req.body);

    if (!payload.issueNumber) {
      res.status(400).json({ success: false, error: 'Missing required field: issueNumber' });
      return;
    }

    // Note: This is for legacy GitHub issue closing
    // In the new Firestore-only system, you would close tasks by taskId
    // This endpoint is kept for backward compatibility

    console.log(`⚠️ Close task requested for issue #${payload.issueNumber}`);
    console.log('Note: This is a legacy endpoint. Consider migrating to direct Firestore updates.');

    res.json({
      success: true,
      action: 'closed',
      issueNumber: payload.issueNumber,
      note: 'Legacy endpoint - no action taken in Firestore-only mode',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('ERROR in closeTaskFromWebhook:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: errorMessage,
    });
  }
});
