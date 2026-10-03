export type ElementType =
  | 'sticky'
  | 'text'
  | 'shape'
  | 'drawing'
  | 'image'
  | 'video'
  | 'link'
  | 'connector'
  | 'frame'
  | 'mindmap-node'
  | 'task'
  | 'hotspot';

export type ShapeSubtype = 'rectangle' | 'circle' | 'diamond' | 'triangle' | 'star';
export type ConnectorAnchor = 'top' | 'bottom' | 'left' | 'right' | 'center';
export type ConnectorEnd = 'none' | 'arrow' | 'circle';
export type ConnectorRouting = 'orthogonal' | 'straight' | 'curved';

export interface Point {
  x: number;
  y: number;
}

export interface ElementMeta {
  createdBy?: string;
  createdAt: number;
  updatedBy?: string;
  updatedAt: number;
  sourceDocRef?: string;
}

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  groupId?: string;
  frameId?: string;
  parentId?: string;
  meta: ElementMeta;
}

export interface StickyElement extends BaseElement {
  type: 'sticky';
  content: string;
  style: {
    color: string;
    fontSize?: number;
    textAlign?: 'left' | 'center' | 'right';
  };
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  style: {
    fontSize: number;
    fontFamily?: string;
    color: string;
    textAlign?: 'left' | 'center' | 'right';
    isBold?: boolean;
    isItalic?: boolean;
  };
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: ShapeSubtype;
  content?: string;
  style: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed';
    color?: string;
  };
}

export interface DrawingElement extends BaseElement {
  type: 'drawing';
  points: Point[];
  style: {
    stroke: string;
    strokeWidth: number;
  };
}

export interface ImageElement extends BaseElement {
  type: 'image';
  assetId?: string;
  url: string;
  alt?: string;
  style?: {
    borderRadius?: number;
    border?: string;
  };
}

export interface VideoElement extends BaseElement {
  type: 'video';
  videoType: 'upload' | 'youtube' | 'vimeo';
  url: string;
  assetId?: string;
  title?: string;
}

export interface LinkElement extends BaseElement {
  type: 'link';
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

export interface ConnectorElement extends BaseElement {
  type: 'connector';
  fromId: string;
  toId: string;
  fromAnchor?: ConnectorAnchor;
  toAnchor?: ConnectorAnchor;
  startEnd: ConnectorEnd;
  endEnd: ConnectorEnd;
  label?: string;
  routing: ConnectorRouting;
  style: {
    stroke: string;
    strokeWidth: number;
    strokeStyle?: 'solid' | 'dashed';
  };
}

export interface FrameElement extends BaseElement {
  type: 'frame';
  title: string;
  order?: number;
  style: {
    background?: string;
    border: string;
    titleColor?: string;
  };
}

export interface MindMapNodeElement extends BaseElement {
  type: 'mindmap-node';
  parentId?: string;
  order: number;
  collapsed?: boolean;
  content: string;
  style: {
    color: string;
    fill: string;
    stroke: string;
  };
}

export interface TaskElement extends BaseElement {
  type: 'task';
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  assigneeName?: string;
  assigneeId?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface HotspotElement extends BaseElement {
  type: 'hotspot';
  targetFrameId: string;
  label: string;
  tooltip?: string;
}

export type BoardElement =
  | StickyElement
  | TextElement
  | ShapeElement
  | DrawingElement
  | ImageElement
  | VideoElement
  | LinkElement
  | ConnectorElement
  | FrameElement
  | MindMapNodeElement
  | TaskElement
  | HotspotElement;

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor?: Point;
  selectedIds: string[];
  lastActive: number;
}
