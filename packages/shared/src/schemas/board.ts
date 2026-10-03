import { z } from 'zod';

export const SCHEMA_VERSION = 1;

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const ElementMetaSchema = z.object({
  createdBy: z.string().optional(),
  createdAt: z.number(),
  updatedBy: z.string().optional(),
  updatedAt: z.number(),
  sourceDocRef: z.string().optional(),
});

export const BaseElementSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().min(1),
  height: z.number().min(1),
  rotation: z.number().optional().default(0),
  zIndex: z.number().default(1),
  groupId: z.string().optional(),
  frameId: z.string().optional(),
  parentId: z.string().optional(),
  meta: ElementMetaSchema,
});

export const StickyElementSchema = BaseElementSchema.extend({
  type: z.literal('sticky'),
  content: z.string().default(''),
  style: z.object({
    color: z.string().default('#fef08a'),
    fontSize: z.number().optional().default(16),
    textAlign: z.enum(['left', 'center', 'right']).optional().default('left'),
  }),
});

export const TextElementSchema = BaseElementSchema.extend({
  type: z.literal('text'),
  content: z.string().default(''),
  style: z.object({
    fontSize: z.number().default(20),
    fontFamily: z.string().optional(),
    color: z.string().default('#000000'),
    textAlign: z.enum(['left', 'center', 'right']).optional().default('left'),
    isBold: z.boolean().optional().default(false),
    isItalic: z.boolean().optional().default(false),
  }),
});

export const ShapeElementSchema = BaseElementSchema.extend({
  type: z.literal('shape'),
  shapeType: z.enum(['rectangle', 'circle', 'diamond', 'triangle', 'star']),
  content: z.string().optional().default(''),
  style: z.object({
    fill: z.string().default('#e2e8f0'),
    stroke: z.string().default('#475569'),
    strokeWidth: z.number().default(2),
    strokeStyle: z.enum(['solid', 'dashed']).optional().default('solid'),
    color: z.string().optional().default('#000000'),
  }),
});

export const DrawingElementSchema = BaseElementSchema.extend({
  type: z.literal('drawing'),
  points: z.array(PointSchema),
  style: z.object({
    stroke: z.string().default('#000000'),
    strokeWidth: z.number().default(3),
  }),
});

export const ImageElementSchema = BaseElementSchema.extend({
  type: z.literal('image'),
  assetId: z.string().optional(),
  url: z.string().url(),
  alt: z.string().optional().default(''),
  style: z.object({
    borderRadius: z.number().optional().default(4),
    border: z.string().optional(),
  }).optional(),
});

export const VideoElementSchema = BaseElementSchema.extend({
  type: z.literal('video'),
  videoType: z.enum(['upload', 'youtube', 'vimeo']),
  url: z.string(),
  assetId: z.string().optional(),
  title: z.string().optional(),
});

export const LinkElementSchema = BaseElementSchema.extend({
  type: z.literal('link'),
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  favicon: z.string().optional(),
});

export const ConnectorElementSchema = BaseElementSchema.extend({
  type: z.literal('connector'),
  fromId: z.string(),
  toId: z.string(),
  fromAnchor: z.enum(['top', 'bottom', 'left', 'right', 'center']).optional().default('center'),
  toAnchor: z.enum(['top', 'bottom', 'left', 'right', 'center']).optional().default('center'),
  startEnd: z.enum(['none', 'arrow', 'circle']).default('none'),
  endEnd: z.enum(['none', 'arrow', 'circle']).default('arrow'),
  label: z.string().optional(),
  routing: z.enum(['orthogonal', 'straight', 'curved']).default('orthogonal'),
  style: z.object({
    stroke: z.string().default('#64748b'),
    strokeWidth: z.number().default(2),
    strokeStyle: z.enum(['solid', 'dashed']).optional().default('solid'),
  }),
});

export const FrameElementSchema = BaseElementSchema.extend({
  type: z.literal('frame'),
  title: z.string().min(1),
  order: z.number().optional().default(0),
  style: z.object({
    background: z.string().optional().default('rgba(241, 245, 249, 0.4)'),
    border: z.string().default('2px dashed #94a3b8'),
    titleColor: z.string().optional().default('#334155'),
  }),
});

export const MindMapNodeElementSchema = BaseElementSchema.extend({
  type: z.literal('mindmap-node'),
  parentId: z.string().optional(),
  order: z.number().default(0),
  collapsed: z.boolean().optional().default(false),
  content: z.string().default(''),
  style: z.object({
    color: z.string().default('#1e293b'),
    fill: z.string().default('#ffffff'),
    stroke: z.string().default('#3b82f6'),
  }),
});

export const TaskElementSchema = BaseElementSchema.extend({
  type: z.literal('task'),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  assigneeName: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const HotspotElementSchema = BaseElementSchema.extend({
  type: z.literal('hotspot'),
  targetFrameId: z.string(),
  label: z.string().default('Lien'),
  tooltip: z.string().optional(),
});

export const BoardElementSchema = z.discriminatedUnion('type', [
  StickyElementSchema,
  TextElementSchema,
  ShapeElementSchema,
  DrawingElementSchema,
  ImageElementSchema,
  VideoElementSchema,
  LinkElementSchema,
  ConnectorElementSchema,
  FrameElementSchema,
  MindMapNodeElementSchema,
  TaskElementSchema,
  HotspotElementSchema,
]);

export const BoardDocumentSchema = z.object({
  schemaVersion: z.number().default(SCHEMA_VERSION),
  elements: z.record(z.string(), BoardElementSchema),
});
