import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import { nanoid } from 'nanoid';
import { OperationPlan, BoardOperation } from '@whiteboard/shared';

export interface ParseDocumentParams {
  buffer?: Buffer | Uint8Array;
  text?: string;
  filename: string;
  mimeType: string;
  format: 'mindmap' | 'outline' | 'timeline';
  boardId: string;
  originX?: number;
  originY?: number;
}

export async function parseDocumentToBoard(params: ParseDocumentParams): Promise<OperationPlan> {
  let extractedText = params.text || '';
  const maxBytes = 10 * 1024 * 1024; // 10 Mo max

  if (params.buffer && params.buffer.byteLength > maxBytes) {
    throw new Error('Le fichier est trop volumineux. La taille maximale autorisée est de 10 Mo.');
  }

  // 1. Extraction selon le format de fichier
  if (params.buffer) {
    const ext = params.filename.split('.').pop()?.toLowerCase();

    if (ext === 'docx') {
      try {
        const result = await mammoth.extractRawText({ buffer: Buffer.from(params.buffer) });
        extractedText = result.value;
      } catch (err: any) {
        throw new Error(`Échec de la lecture du fichier Word DOCX : ${err.message}`);
      }
    } else if (ext === 'pdf') {
      try {
        const pdfResult = await extractText(new Uint8Array(params.buffer));
        extractedText = Array.isArray(pdfResult.text) ? pdfResult.text.join('\n') : (pdfResult.text as string);
        if (!extractedText.trim()) {
          throw new Error('Le PDF semble scanné ou ne contient aucun texte extractible.');
        }
      } catch (err: any) {
        throw new Error(err.message || 'Impossible d’extraire le texte du PDF.');
      }
    } else if (ext === 'txt' || params.mimeType.includes('text/plain')) {
      extractedText = Buffer.from(params.buffer).toString('utf-8');
    } else {
      throw new Error(`Format non supporté (${ext}). Formats acceptés : TXT, DOCX, PDF avec texte.`);
    }
  }

  if (!extractedText.trim()) {
    throw new Error('Aucun contenu textuel n’a pu être extrait du document.');
  }

  // 2. Découper les sections et lignes significatives
  const lines = extractedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2)
    .slice(0, 16); // 16 éléments max pour une disposition propre

  const startX = params.originX || 250;
  const startY = params.originY || 200;
  const operations: BoardOperation[] = [];

  const sourceRef = `Source: ${params.filename}`;

  if (params.format === 'mindmap') {
    // Racine centrale de la mind map
    const rootId = nanoid();
    operations.push({
      kind: 'create',
      element: {
        id: rootId,
        type: 'mindmap-node',
        rotation: 0,
        collapsed: false,
        order: 0,
        content: params.filename.replace(/\.[^/.]+$/, ''),
        x: startX,
        y: startY,
        width: 180,
        height: 50,
        zIndex: 10,
        style: { fill: '#3b82f6', color: '#ffffff', stroke: '#1d4ed8' },
        meta: { createdAt: Date.now(), updatedAt: Date.now(), sourceDocRef: sourceRef },
      },
    });

    lines.slice(0, 8).forEach((line, idx) => {
      const childId = nanoid();
      const angle = (idx / 8) * Math.PI * 2;
      const radius = 260;
      const childX = Math.round(startX + Math.cos(angle) * radius);
      const childY = Math.round(startY + Math.sin(angle) * radius);

      operations.push({
        kind: 'create',
        element: {
          id: childId,
          type: 'mindmap-node',
          parentId: rootId,
          rotation: 0,
          collapsed: false,
          order: idx + 1,
          content: line.slice(0, 60),
          x: childX,
          y: childY,
          width: 180,
          height: 48,
          zIndex: 11 + idx,
          style: { fill: '#f1f5f9', color: '#1e293b', stroke: '#94a3b8' },
          meta: { createdAt: Date.now(), updatedAt: Date.now(), sourceDocRef: sourceRef },
        },
      });

      // Connecteur automatique
      operations.push({
        kind: 'connect',
        connectorId: nanoid(),
        fromId: rootId,
        toId: childId,
      });
    });
  } else if (params.format === 'timeline') {
    // Disposition en frise chronologique horizontale
    lines.slice(0, 8).forEach((line, idx) => {
      const nodeId = nanoid();
      const nodeX = startX + idx * 240;

      operations.push({
        kind: 'create',
        element: {
          id: nodeId,
          type: 'sticky',
          rotation: 0,
          x: nodeX,
          y: startY,
          width: 200,
          height: 120,
          zIndex: 10 + idx,
          content: `Étape ${idx + 1} : ${line.slice(0, 80)}`,
          style: { color: idx % 2 === 0 ? '#bae6fd' : '#bbf7d0', fontSize: 13, textAlign: 'left' },
          meta: { createdAt: Date.now(), updatedAt: Date.now(), sourceDocRef: sourceRef },
        },
      });

      if (idx > 0) {
        operations.push({
          kind: 'connect',
          connectorId: nanoid(),
          fromId: operations[operations.length - 2].kind === 'create' ? (operations[operations.length - 2] as any).element.id : '',
          toId: nodeId,
          label: `->`,
        });
      }
    });
  } else {
    // Mode Plan (colonnes hiérarchiques)
    lines.forEach((line, idx) => {
      operations.push({
        kind: 'create',
        element: {
          id: nanoid(),
          type: 'sticky',
          rotation: 0,
          x: startX + (idx % 4) * 220,
          y: startY + Math.floor(idx / 4) * 150,
          width: 200,
          height: 130,
          zIndex: 10 + idx,
          content: line.slice(0, 100),
          style: { color: '#fef08a', fontSize: 13, textAlign: 'left' },
          meta: { createdAt: Date.now(), updatedAt: Date.now(), sourceDocRef: sourceRef },
        },
      });
    });
  }

  return {
    id: nanoid(),
    summary: `Import document : ${params.filename} (${lines.length} éléments)`,
    scope: { type: 'full_board' },
    operations,
    createdAt: Date.now(),
  };
}
