import { describe, it, expect } from 'vitest';
import {
  BoardElementSchema,
  OperationPlanSchema,
  validatePlanScope,
} from '@whiteboard/shared';

describe('Schémas Zod & Moteur d’Opérations', () => {
  it('valide un élément de type sticky conforme', () => {
    const validSticky = {
      id: 'sticky-1',
      type: 'sticky',
      x: 100,
      y: 150,
      width: 200,
      height: 140,
      zIndex: 1,
      content: 'Brainstorming Sprint 1',
      style: {
        color: '#fef08a',
        fontSize: 14,
        textAlign: 'left',
      },
      meta: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    const parsed = BoardElementSchema.safeParse(validSticky);
    expect(parsed.success).toBe(true);
  });

  it('valide un connecteur orthogonal avec ses ancres', () => {
    const validConnector = {
      id: 'conn-1',
      type: 'connector',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      zIndex: 10,
      fromId: 'node-a',
      toId: 'node-b',
      fromAnchor: 'right',
      toAnchor: 'left',
      startEnd: 'none',
      endEnd: 'arrow',
      routing: 'orthogonal',
      label: 'Dépendance',
      style: {
        stroke: '#64748b',
        strokeWidth: 2,
        strokeStyle: 'solid',
      },
      meta: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    const parsed = BoardElementSchema.safeParse(validConnector);
    expect(parsed.success).toBe(true);
  });

  it('rejette un élément ayant des dimensions négatives ou nulles', () => {
    const invalidElement = {
      id: 'bad-1',
      type: 'sticky',
      x: 0,
      y: 0,
      width: -50,
      height: 100,
      zIndex: 1,
      content: '',
      style: { color: '#fef08a' },
      meta: { createdAt: 1, updatedAt: 1 },
    };

    const parsed = BoardElementSchema.safeParse(invalidElement);
    expect(parsed.success).toBe(false);
  });

  it('vérifie le respect du périmètre autorisé d’un plan d’opérations', () => {
    const plan = {
      id: 'plan-1',
      summary: 'Déplacer la sélection',
      scope: { type: 'selection' as const, targetIds: ['node-1', 'node-2'] },
      operations: [
        {
          kind: 'move' as const,
          elementId: 'node-1',
          dx: 50,
          dy: 0,
        },
        {
          kind: 'move' as const,
          elementId: 'node-999', // Hors périmètre !
          dx: 50,
          dy: 0,
        },
      ],
      createdAt: Date.now(),
    };

    const validation = validatePlanScope(plan, {
      type: 'selection',
      targetIds: ['node-1', 'node-2'],
    });

    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('dépasse le périmètre autorisé');
  });
});
