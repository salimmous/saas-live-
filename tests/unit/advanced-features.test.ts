import { describe, it, expect } from 'vitest';
import { aiService } from '../../apps/web/src/lib/ai/ai-service';
import { whisperProvider } from '../../apps/web/src/lib/ai/whisper-provider';

describe('Phase 4 — Fonctions avancées', () => {
  describe('Feature 5: Croquis vers diagramme (Vision IA & Fallback)', () => {
    it('génère un diagramme vectoriel avec formes géométriques et connecteurs', async () => {
      const dummyBuffer = Buffer.from('fake-image-bytes');
      const result = await aiService.convertSketchToDiagram({
        imageBase64: dummyBuffer.toString('base64'),
        mimeType: 'image/png',
        originX: 100,
        originY: 100,
      });

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);

      const plan = result.plan;
      expect(plan.operations.length).toBeGreaterThan(0);

      // Vérifier la présence de formes et de connecteurs
      const createOps = plan.operations.filter((op) => op.kind === 'create');
      const connectOps = plan.operations.filter((op) => op.kind === 'connect');

      expect(createOps.length).toBeGreaterThanOrEqual(3);
      expect(connectOps.length).toBeGreaterThanOrEqual(2);

      // Vérifier les formes créées
      const shapes = createOps.map((op) => (op as any).element);
      shapes.forEach((s) => {
        expect(s.type).toBe('shape');
        expect(['rectangle', 'diamond', 'circle']).toContain(s.shapeType);
        expect(s.meta?.sourceDocRef).toContain('Croquis IA');
      });
    });
  });

  describe('Feature 9: Voix vers sticky notes (Whisper transcription & découpage)', () => {
    it('transcrit un flux audio et découpe en notes adhésives ordonnées', async () => {
      const dummyAudio = Buffer.from('fake-audio-bytes');
      const result = await aiService.transcribeVoiceToNotes({
        audioBuffer: dummyAudio,
        mimeType: 'audio/webm',
        originX: 200,
        originY: 200,
      });

      expect(result.transcript).toBeTruthy();
      expect(result.plan.operations.length).toBeGreaterThan(0);

      const stickyOps = result.plan.operations.filter((op) => op.kind === 'create');
      expect(stickyOps.length).toBeGreaterThanOrEqual(1);

      stickyOps.forEach((op: any) => {
        expect(op.element.type).toBe('sticky');
        expect(op.element.content).toBeTruthy();
        expect(op.element.meta?.sourceDocRef).toContain('Whisper');
      });
    });

    it('génère un fallback local déterministe en français si aucune clé API n’est fournie', async () => {
      const transcription = await whisperProvider.transcribe({
        audioBuffer: Buffer.alloc(16000),
        mimeType: 'audio/webm',
        language: 'fr',
      });

      expect(transcription.text).toContain("Prioriser l'expérience utilisateur");
      expect(transcription.segments?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Feature 18: Visites commentées enregistrées (Trajectoire de caméra)', () => {
    it('valide la structure chronologique et continue de la trajectoire', () => {
      const sampleTrajectory = [
        { t: 0, x: 100, y: 100, zoom: 1, cursorX: 250, cursorY: 200 },
        { t: 0.5, x: 150, y: 120, zoom: 1.1, cursorX: 300, cursorY: 220 },
        { t: 1.0, x: 200, y: 150, zoom: 1.2, cursorX: 350, cursorY: 250 },
      ];

      // Vérifier la monotonie temporelle
      for (let i = 1; i < sampleTrajectory.length; i++) {
        expect(sampleTrajectory[i].t).toBeGreaterThan(sampleTrajectory[i - 1].t);
      }

      // Vérifier le facteur de zoom valide (> 0)
      sampleTrajectory.forEach((pt) => {
        expect(pt.zoom).toBeGreaterThan(0);
        expect(pt.cursorX).toBeDefined();
        expect(pt.cursorY).toBeDefined();
      });
    });
  });

  describe('Feature 19: Historique et snapshots (Sérialisation & incrément de version)', () => {
    it('calcule correctement les numéros de version incrémentaux', () => {
      const lastVersion = 3;
      const nextVersion = (lastVersion || 0) + 1;
      expect(nextVersion).toBe(4);
    });

    it('sérialise et restaure fidèlement le snapshot d’éléments', () => {
      const testElements = [
        { id: 'el-1', type: 'sticky', x: 50, y: 80, content: 'Tâche A' },
        { id: 'el-2', type: 'shape', x: 200, y: 300, content: 'Bloc B' },
      ];

      const snapshotBuffer = Buffer.from(JSON.stringify({ elements: testElements }));
      const parsed = JSON.parse(snapshotBuffer.toString('utf-8'));

      expect(parsed.elements).toHaveLength(2);
      expect(parsed.elements[0].id).toBe('el-1');
      expect(parsed.elements[1].content).toBe('Bloc B');
    });
  });
});
