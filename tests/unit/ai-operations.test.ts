import { describe, it, expect } from 'vitest';
import { validatePlanScope, computeAutoLayout, OperationPlan, BoardElement } from '@whiteboard/shared';
import { parseDocumentToBoard } from '@/lib/ai/doc-parser';
import { aiService } from '@/lib/ai/ai-service';

describe('Phase 2 — Opérations IA, Portée & Mind Maps', () => {
  it('valide strictement le périmètre d’un plan d’opérations (validatePlanScope)', () => {
    const selectedIds = ['el-1', 'el-2'];

    // Plan valide : ne modifie que les éléments sélectionnés
    const validPlan: OperationPlan = {
      id: 'plan-1',
      summary: 'Mise à jour autorisée',
      scope: { type: 'selection', targetIds: selectedIds },
      operations: [
        { kind: 'update', elementId: 'el-1', patch: { x: 150 } },
        { kind: 'create', element: { id: 'el-new', type: 'sticky', x: 200, y: 200, width: 200, height: 200, zIndex: 1, rotation: 0, content: 'Nouvelle idée', style: { color: '#fef08a' }, meta: { createdAt: Date.now(), updatedAt: Date.now() } } },
      ],
      createdAt: Date.now(),
    };

    expect(validatePlanScope(validPlan, { type: 'selection', targetIds: selectedIds }).valid).toBe(true);

    // Plan invalide : tente de modifier un élément hors sélection ('el-3')
    const invalidPlan: OperationPlan = {
      id: 'plan-2',
      summary: 'Mutation non autorisée',
      scope: { type: 'selection', targetIds: selectedIds },
      operations: [
        { kind: 'update', elementId: 'el-3', patch: { x: 500 } },
      ],
      createdAt: Date.now(),
    };

    expect(validatePlanScope(invalidPlan, { type: 'selection', targetIds: selectedIds }).valid).toBe(false);
  });

  it('calcule la disposition automatique Dagre / Grille', () => {
    const testElements: BoardElement[] = [
      { id: 'n1', type: 'mindmap-node', x: 0, y: 0, width: 180, height: 50, zIndex: 1, rotation: 0, collapsed: false, order: 0, content: 'Racine', style: { fill: '#3b82f6', color: '#fff', stroke: '#1d4ed8' }, meta: { createdAt: 0, updatedAt: 0 } },
      { id: 'n2', type: 'mindmap-node', parentId: 'n1', x: 0, y: 0, width: 180, height: 50, zIndex: 2, rotation: 0, collapsed: false, order: 1, content: 'Enfant 1', style: { fill: '#f1f5f9', color: '#1e293b', stroke: '#94a3b8' }, meta: { createdAt: 0, updatedAt: 0 } },
      { id: 'n3', type: 'mindmap-node', parentId: 'n1', x: 0, y: 0, width: 180, height: 50, zIndex: 3, rotation: 0, collapsed: false, order: 2, content: 'Enfant 2', style: { fill: '#f1f5f9', color: '#1e293b', stroke: '#94a3b8' }, meta: { createdAt: 0, updatedAt: 0 } },
    ];

    const positions = computeAutoLayout(testElements, { startX: 100, startY: 100 });
    expect(positions.length).toBe(3);
    expect(positions.find((p) => p.id === 'n1')).toBeDefined();
    // Les positions calculées sont distinctes
    const distinctCoords = new Set(positions.map((p) => `${p.x},${p.y}`));
    expect(distinctCoords.size).toBe(3);
  });

  it('convertit un document texte en mind map avec traçabilité sourceDocRef', async () => {
    const content = Buffer.from('Introduction au projet\nArchitecture technique\nCollaboration temps réel\nSécurité des flux');
    const plan = await parseDocumentToBoard({
      filename: 'spec-projet.txt',
      mimeType: 'text/plain',
      boardId: 'test-board',
      buffer: content,
      format: 'mindmap',
      originX: 100,
      originY: 100,
    });

    expect(plan.operations.length).toBeGreaterThanOrEqual(4);
    const createOps = plan.operations.filter((op) => op.kind === 'create');
    expect(createOps.length).toBeGreaterThanOrEqual(2);
    // Vérifier la traçabilité de source
    const root = createOps[0];
    if (root.kind === 'create') {
      expect(root.element.meta.sourceDocRef).toContain('spec-projet.txt');
    }
  });

  it('génère un diagramme déterministe en mode repli sans clé API', async () => {
    const plan = await aiService.generateDiagram({
      prompt: 'Cycle de vente B2B',
      diagramType: 'flowchart',
      boardId: 'test-board',
      originX: 200,
      originY: 200,
    });

    expect(plan.operations.length).toBeGreaterThan(0);
    const shapeOps = plan.operations.filter((op) => op.kind === 'create');
    expect(shapeOps.length).toBeGreaterThanOrEqual(4);
  });
});
