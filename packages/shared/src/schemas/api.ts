import { z } from 'zod';
import { BoardElementSchema } from './board.js';
import { OperationPlanSchema } from './operations.js';

export const CreateGuestLinkSchema = z.object({
  boardId: z.string().min(1),
  role: z.enum(['editor', 'reader']).default('reader'),
  name: z.string().optional(),
  expiresInHours: z.number().min(1).max(720).optional(),
});

export const JoinGuestSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1, 'Le pseudonyme est requis'),
});

export const GenerateDiagramRequestSchema = z.object({
  boardId: z.string(),
  prompt: z.string().min(3),
  diagramType: z.enum(['flowchart', 'mindmap', 'sequence', 'auto']).default('auto'),
});

export const NaturalLanguageEditRequestSchema = z.object({
  boardId: z.string(),
  instruction: z.string().min(3),
  scope: z.enum(['selection', 'full_board']).default('selection'),
  selectedIds: z.array(z.string()).default([]),
});

export const ClusterIdeasRequestSchema = z.object({
  boardId: z.string(),
  selectedIds: z.array(z.string()).min(2, 'Au moins 2 notes sont requises pour un regroupement'),
});

export const DocToBoardRequestSchema = z.object({
  boardId: z.string(),
  format: z.enum(['mindmap', 'outline', 'timeline']).default('mindmap'),
  content: z.string().optional(),
});

export const AskBoardRequestSchema = z.object({
  boardId: z.string(),
  question: z.string().min(3),
});

export const TransformToActionPlanRequestSchema = z.object({
  boardId: z.string(),
  selectedIds: z.array(z.string()).min(1),
});

export const VoteSessionCreateSchema = z.object({
  boardId: z.string(),
  title: z.string().min(1).default('Session de vote'),
  votesPerUser: z.number().int().min(1).max(20).default(3),
});

export const CastVoteSchema = z.object({
  sessionId: z.string(),
  elementId: z.string(),
});

export const BrainstormDraftSchema = z.object({
  boardId: z.string(),
  elementData: BoardElementSchema,
});
