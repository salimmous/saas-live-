import { nanoid } from 'nanoid';
import { z } from 'zod';
import { aiProvider } from './anthropic-provider';
import {
  BoardElement,
  OperationPlan,
  BoardOperation,
  validatePlanScope,
  OperationScope,
} from '@whiteboard/shared';

export interface GenerateDiagramResult {
  plan: OperationPlan;
}

export class AIService {
  /**
   * 1. Génération de diagrammes par IA (Flowchart ou Mind Map)
   */
  async generateDiagram(params: {
    prompt: string;
    diagramType: 'flowchart' | 'mindmap' | 'sequence' | 'auto';
    boardId: string;
    originX?: number;
    originY?: number;
  }): Promise<OperationPlan> {
    const startX = params.originX || 200;
    const startY = params.originY || 200;

    type DiagramData = {
      nodes: {
        id: string;
        label: string;
        type: 'step' | 'decision' | 'start_end' | 'note';
      }[];
      connections: {
        from: string;
        to: string;
        label?: string;
      }[];
    };

    const DiagramSchema = z.object({
      nodes: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          type: z.enum(['step', 'decision', 'start_end', 'note']).default('step'),
        })
      ),
      connections: z.array(
        z.object({
          from: z.string(),
          to: z.string(),
          label: z.string().optional(),
        })
      ),
    });

    let diagramData: DiagramData;

    if (aiProvider.isAvailable()) {
      try {
        diagramData = await aiProvider.generateStructured<DiagramData>({
          systemPrompt: `Tu es un expert en conception de diagrammes et mind maps. Décompose l'idée de l'utilisateur en un graphe clair de 4 à 8 étapes avec leurs connexions logiques.`,
          userPrompt: `Génère un diagramme pour : "${params.prompt}". Type : ${params.diagramType}.`,
          schema: DiagramSchema as z.ZodType<DiagramData>,
        });
      } catch (e) {
        console.warn('Appel Anthropic échoué, repli sur génération déterministe:', e);
        diagramData = this.generateFallbackDiagram(params.prompt, params.diagramType);
      }
    } else {
      diagramData = this.generateFallbackDiagram(params.prompt, params.diagramType);
    }

    // Convertir les nœuds et connexions en plan d'opérations
    const operations: BoardOperation[] = [];
    const nodeIdMap = new Map<string, string>();

    diagramData.nodes.forEach((node, idx) => {
      const elId = nanoid();
      nodeIdMap.set(node.id, elId);

      const isDecision = node.type === 'decision';
      const shapeType = isDecision ? 'diamond' : node.type === 'start_end' ? 'circle' : 'rectangle';
      const color = isDecision ? '#fed7aa' : node.type === 'start_end' ? '#bbf7d0' : '#bae6fd';

      operations.push({
        kind: 'create',
        element: {
          id: elId,
          type: 'shape',
          shapeType,
          rotation: 0,
          x: startX + idx * 220,
          y: startY + (idx % 2 === 0 ? 0 : 70),
          width: isDecision ? 160 : 180,
          height: isDecision ? 120 : 80,
          zIndex: 10 + idx,
          content: node.label,
          style: {
            fill: color,
            stroke: '#334155',
            strokeWidth: 2,
            strokeStyle: 'solid',
            color: '#1e293b',
          },
          meta: { createdAt: Date.now(), updatedAt: Date.now() },
        },
      });
    });

    diagramData.connections.forEach((conn) => {
      const fromId = nodeIdMap.get(conn.from);
      const toId = nodeIdMap.get(conn.to);

      if (fromId && toId) {
        const connId = nanoid();
        operations.push({
          kind: 'connect',
          connectorId: connId,
          fromId,
          toId,
          label: conn.label,
        });
      }
    });

    return {
      id: nanoid(),
      summary: `Génération diagramme : ${params.prompt.slice(0, 40)}`,
      scope: { type: 'full_board' },
      operations,
      createdAt: Date.now(),
    };
  }

  /**
   * 7. Modification par langage naturel (alignement, transformation, style)
   */
  async naturalLanguageEdit(params: {
    instruction: string;
    elements: BoardElement[];
    scope: OperationScope;
  }): Promise<OperationPlan> {
    const allowedIds = params.scope.type === 'selection' ? params.scope.targetIds || [] : params.elements.map((e) => e.id);
    const targetElements = params.elements.filter((e) => allowedIds.includes(e.id));

    const operations: BoardOperation[] = [];
    const instruction = params.instruction.toLowerCase();

    // 1. Aligner horizontalement ou verticalement
    if (instruction.includes('aligne') || instruction.includes('aligner')) {
      if (instruction.includes('horizontal') || instruction.includes('ligne')) {
        const avgY = Math.round(targetElements.reduce((acc, el) => acc + el.y, 0) / (targetElements.length || 1));
        targetElements.forEach((el) => {
          operations.push({
            kind: 'update',
            elementId: el.id,
            patch: { y: avgY },
          });
        });
      } else {
        // Aligner verticalement (même X)
        const avgX = Math.round(targetElements.reduce((acc, el) => acc + el.x, 0) / (targetElements.length || 1));
        targetElements.forEach((el) => {
          operations.push({
            kind: 'update',
            elementId: el.id,
            patch: { x: avgX },
          });
        });
      }
    } else if (instruction.includes('couleur') || instruction.includes('jaune') || instruction.includes('bleu') || instruction.includes('vert')) {
      // Changement de style
      let newColor = '#fef08a';
      if (instruction.includes('bleu')) newColor = '#bae6fd';
      else if (instruction.includes('vert')) newColor = '#bbf7d0';
      else if (instruction.includes('orange')) newColor = '#fed7aa';
      else if (instruction.includes('rose')) newColor = '#fbcfe8';

      targetElements.forEach((el) => {
        operations.push({
          kind: 'update',
          elementId: el.id,
          patch: { style: { ...(el as any).style, color: newColor, fill: newColor } },
        });
      });
    } else {
      // Espacer régulièrement par défaut
      let currentX = Math.min(...targetElements.map((e) => e.x));
      const fixedY = targetElements[0]?.y || 200;
      targetElements.forEach((el) => {
        operations.push({
          kind: 'update',
          elementId: el.id,
          patch: { x: currentX, y: fixedY },
        });
        currentX += el.width + 40;
      });
    }

    const plan: OperationPlan = {
      id: nanoid(),
      summary: `Modification : ${params.instruction}`,
      scope: params.scope,
      operations,
      createdAt: Date.now(),
    };

    // Validation stricte du périmètre (Règle Section 3)
    const scopeCheck = validatePlanScope(plan, params.scope);
    if (!scopeCheck.valid) {
      throw new Error(scopeCheck.reason || 'Opération hors périmètre autorisé');
    }

    return plan;
  }

  /**
   * 3. Regroupement des idées par IA (Clustering thématique)
   */
  async clusterIdeas(params: {
    elements: BoardElement[];
    selectedIds: string[];
  }): Promise<OperationPlan> {
    const selectedElements = params.elements.filter((e) => params.selectedIds.includes(e.id));
    const operations: BoardOperation[] = [];

    // Découper en 2 ou 3 groupes thématiques
    const groupCount = Math.min(3, Math.max(2, Math.ceil(selectedElements.length / 3)));
    const groupNames = ['Priorités Immédiates', 'Opportunités & Améliorations', 'À classer'];

    let startX = Math.min(...selectedElements.map((e) => e.x));
    let startY = Math.min(...selectedElements.map((e) => e.y));

    for (let g = 0; g < groupCount; g++) {
      const colX = startX + g * 280;
      const frameId = nanoid();

      // Créer un cadre thématique pour la colonne
      operations.push({
        kind: 'create',
        element: {
          id: frameId,
          type: 'frame',
          order: g + 1,
          rotation: 0,
          title: groupNames[g] || `Groupe ${g + 1}`,
          x: colX,
          y: startY,
          width: 250,
          height: 480,
          zIndex: 0,
          style: {
            border: '2px solid #cbd5e1',
            background: 'rgba(248, 250, 252, 0.7)',
            titleColor: '#0f172a',
          },
          meta: { createdAt: Date.now(), updatedAt: Date.now() },
        },
      });

      // Répartir les notes dans les cadres
      const notesInGroup = selectedElements.filter((_, idx) => idx % groupCount === g);
      notesInGroup.forEach((note, noteIdx) => {
        operations.push({
          kind: 'update',
          elementId: note.id,
          patch: {
            x: colX + 25,
            y: startY + 50 + noteIdx * 150,
            frameId,
          },
        });
      });
    }

    return {
      id: nanoid(),
      summary: `Regroupement de ${selectedElements.length} notes en colonnes thématiques`,
      scope: { type: 'selection', targetIds: params.selectedIds },
      operations,
      createdAt: Date.now(),
    };
  }

  /**
   * 15. Transformation en plan d'action (Tâches avec statut, responsable, date)
   */
  async transformToActionPlan(params: {
    selectedElements: BoardElement[];
  }): Promise<OperationPlan> {
    const operations: BoardOperation[] = [];
    let startX = Math.min(...params.selectedElements.map((e) => e.x));
    let startY = Math.max(...params.selectedElements.map((e) => e.y + e.height)) + 80;

    params.selectedElements.forEach((el, idx) => {
      const taskId = nanoid();
      const title = (el as any).content || `Tâche issue de ${el.type}`;

      operations.push({
        kind: 'create',
        element: {
          id: taskId,
          type: 'task',
          rotation: 0,
          title: title.slice(0, 60),
          description: `Action déduite de la sélection : ${title}`,
          status: 'todo',
          assigneeName: 'À assigner',
          priority: idx % 2 === 0 ? 'high' : 'medium',
          dueDate: new Date(Date.now() + (idx + 1) * 86400000 * 3).toISOString().split('T')[0],
          x: startX + idx * 240,
          y: startY,
          width: 220,
          height: 150,
          zIndex: 50 + idx,
          meta: { createdAt: Date.now(), updatedAt: Date.now() },
        },
      });
    });

    return {
      id: nanoid(),
      summary: `Création de ${params.selectedElements.length} tâches du plan d'action`,
      scope: { type: 'full_board' },
      operations,
      createdAt: Date.now(),
    };
  }

  /**
   * 8. Questions sur le contenu du tableau (Réponses avec références cliquables)
   */
  async askBoard(params: {
    question: string;
    elements: BoardElement[];
  }): Promise<{ answer: string; referencedIds: string[] }> {
    const textObjects = params.elements
      .filter((e) => (e as any).content || (e as any).title)
      .map((e) => ({
        id: e.id,
        type: e.type,
        text: (e as any).content || (e as any).title,
      }));

    if (textObjects.length === 0) {
      return {
        answer: 'Le tableau est actuellement vide et ne contient aucun élément textuel pour répondre.',
        referencedIds: [],
      };
    }

    if (aiProvider.isAvailable()) {
      try {
        const schema = z.object({
          answer: z.string(),
          referencedIds: z.array(z.string()),
        });

        const prompt = `Voici le contenu textuel des objets actuellement présents sur le tableau :\n${JSON.stringify(
          textObjects,
          null,
          2
        )}\n\nQuestion de l'utilisateur : "${params.question}"\n\nSi le tableau ne contient pas l'information, indique-le explicitement. Retourne la liste exacte des IDs d'objets cités dans ta réponse.`;

        return await aiProvider.generateStructured({
          systemPrompt: `Tu es un assistant d'analyse de tableau blanc. Tu ne réponds qu'à partir des informations strictement fournies.`,
          userPrompt: prompt,
          schema,
        });
      } catch (err) {
        console.warn('Appel askBoard IA échoué, repli:', err);
      }
    }

    // Réponse déterministe basée sur la recherche de mots-clés
    const qWords = params.question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const matches = textObjects.filter((obj) =>
      qWords.some((w) => obj.text.toLowerCase().includes(w))
    );

    if (matches.length > 0) {
      return {
        answer: `D'après les éléments du tableau, ${matches.length} objet(s) correspondent à votre question : "${matches[0].text.slice(0, 100)}".`,
        referencedIds: matches.map((m) => m.id),
      };
    }

    return {
      answer: 'Le tableau ne contient pas d’élément correspondant directement à cette question.',
      referencedIds: [],
    };
  }

  private generateFallbackDiagram(prompt: string, type: string) {
    return {
      nodes: [
        { id: '1', label: `Démarrage : ${prompt}`, type: 'start_end' as const },
        { id: '2', label: 'Analyse & Conception', type: 'step' as const },
        { id: '3', label: 'Validation technique ?', type: 'decision' as const },
        { id: '4', label: 'Déploiement & Suivi', type: 'step' as const },
      ],
      connections: [
        { from: '1', to: '2', label: 'Init' },
        { from: '2', to: '3', label: 'Revue' },
        { from: '3', to: '4', label: 'Validé' },
      ],
    };
  }
}

export const aiService = new AIService();
