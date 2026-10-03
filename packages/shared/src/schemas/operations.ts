import { z } from 'zod';
import { BoardElementSchema } from './board.js';

export const CreateOperationSchema = z.object({
  kind: z.literal('create'),
  element: BoardElementSchema,
});

export const UpdateOperationSchema = z.object({
  kind: z.literal('update'),
  elementId: z.string(),
  patch: z.record(z.string(), z.any()),
});

export const MoveOperationSchema = z.object({
  kind: z.literal('move'),
  elementId: z.string(),
  dx: z.number(),
  dy: z.number(),
});

export const DeleteOperationSchema = z.object({
  kind: z.literal('delete'),
  elementId: z.string(),
});

export const ConnectOperationSchema = z.object({
  kind: z.literal('connect'),
  connectorId: z.string(),
  fromId: z.string(),
  toId: z.string(),
  label: z.string().optional(),
});

export const BoardOperationSchema = z.discriminatedUnion('kind', [
  CreateOperationSchema,
  UpdateOperationSchema,
  MoveOperationSchema,
  DeleteOperationSchema,
  ConnectOperationSchema,
]);

export type BoardOperation = z.infer<typeof BoardOperationSchema>;

export const OperationScopeSchema = z.object({
  type: z.enum(['selection', 'full_board', 'frame']),
  targetIds: z.array(z.string()).optional(),
  frameId: z.string().optional(),
});

export type OperationScope = z.infer<typeof OperationScopeSchema>;

export const OperationPlanSchema = z.object({
  id: z.string(),
  summary: z.string(),
  scope: OperationScopeSchema,
  operations: z.array(BoardOperationSchema),
  createdAt: z.number(),
});

export type OperationPlan = z.infer<typeof OperationPlanSchema>;

/**
 * Valide si un plan d'opérations respecte le périmètre autorisé.
 * Rejette toute opération modifiant ou supprimant un élément en dehors du périmètre spécifié.
 */
export function validatePlanScope(plan: OperationPlan, authorizedScope: OperationScope): { valid: boolean; reason?: string } {
  if (authorizedScope.type === 'full_board') {
    return { valid: true };
  }

  const allowedIds = new Set(authorizedScope.targetIds || []);

  for (const op of plan.operations) {
    if (op.kind === 'update' || op.kind === 'move' || op.kind === 'delete') {
      if (!allowedIds.has(op.elementId)) {
        return {
          valid: false,
          reason: `L'opération '${op.kind}' sur l'élément '${op.elementId}' dépasse le périmètre autorisé.`,
        };
      }
    }
  }

  return { valid: true };
}
