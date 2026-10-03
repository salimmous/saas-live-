'use client';

import React from 'react';
import { UserPresence, BoardElement } from '@whiteboard/shared';

interface RemoteCursorsProps {
  users: UserPresence[];
  elementsMap: Map<string, BoardElement>;
}

export const RemoteCursors = React.memo(function RemoteCursors({
  users,
  elementsMap,
}: RemoteCursorsProps) {
  return (
    <>
      {/* 1. Rectangles de sélection des autres collaborateurs */}
      {users.map((user) => {
        if (!user.selectedIds || user.selectedIds.length === 0) return null;

        return (
          <React.Fragment key={`sel-${user.id}`}>
            {user.selectedIds.map((id) => {
              const el = elementsMap.get(id);
              if (!el) return null;

              return (
                <div
                  key={`user-sel-${user.id}-${id}`}
                  style={{
                    position: 'absolute',
                    left: `${el.x - 3}px`,
                    top: `${el.y - 3}px`,
                    width: `${el.width + 6}px`,
                    height: `${el.height + 6}px`,
                    border: `2px dashed ${user.color || '#3b82f6'}`,
                    pointerEvents: 'none',
                    zIndex: 40,
                    borderRadius: '8px',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '-18px',
                      left: '0',
                      backgroundColor: user.color || '#3b82f6',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: '600',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.name}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        );
      })}

      {/* 2. Curseurs distants en temps réel */}
      {users.map((user) => {
        if (!user.cursor) return null;

        return (
          <div
            key={`cursor-${user.id}`}
            style={{
              position: 'absolute',
              left: `${user.cursor.x}px`,
              top: `${user.cursor.y}px`,
              pointerEvents: 'none',
              zIndex: 9999,
              transition: 'all 0.05s ease-out',
            }}
          >
            {/* Curseur SVG SVG Arrow */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
            >
              <path
                d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                fill={user.color || '#3b82f6'}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </svg>

            {/* Étiquette avec le nom du collaborateur */}
            <div
              style={{
                backgroundColor: user.color || '#3b82f6',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 8px',
                borderRadius: '6px',
                marginLeft: '14px',
                marginTop: '-4px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              }}
            >
              {user.name}
            </div>
          </div>
        );
      })}
    </>
  );
});
