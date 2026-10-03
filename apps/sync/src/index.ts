import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { prisma } from '@whiteboard/shared';

dotenv.config();

const port = parseInt(process.env.PORT || '1234', 10);

export const server = new Server({
  port,

  async onAuthenticate(data) {
    const { token, documentName } = data;
    const boardId = documentName;

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: { owner: true },
    });

    if (!board) {
      throw new Error('Tableau introuvable');
    }

    // 1. Invité par lien (format "guest:<token>")
    if (token && token.startsWith('guest:')) {
      const rawToken = token.slice(6);
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const guestLink = await prisma.guestLink.findUnique({
        where: { tokenHash },
      });

      if (!guestLink || guestLink.boardId !== boardId || guestLink.revokedAt) {
        throw new Error('Lien invité invalide ou révoqué');
      }

      if (guestLink.expiresAt && guestLink.expiresAt < new Date()) {
        throw new Error('Lien invité expiré');
      }

      if (guestLink.role === 'reader') {
        data.connectionConfig.readOnly = true;
      }

      return {
        user: {
          id: `guest_${tokenHash.slice(0, 8)}`,
          name: guestLink.name || 'Invité',
          role: guestLink.role,
          isGuest: true,
        },
      };
    }

    // 2. Utilisateur connecté via Better-Auth
    if (token) {
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
      });

      if (session && session.expiresAt > new Date()) {
        const userId = session.userId;

        // Propriétaire du tableau
        if (board.ownerId === userId) {
          return {
            user: {
              id: userId,
              name: session.user.name,
              email: session.user.email,
              role: 'owner',
            },
          };
        }

        // Membre avec rôle assigné
        const membership = await prisma.boardMember.findUnique({
          where: {
            boardId_userId: { boardId, userId },
          },
        });

        if (membership) {
          if (membership.role === 'reader') {
            data.connectionConfig.readOnly = true;
          }
          return {
            user: {
              id: userId,
              name: session.user.name,
              email: session.user.email,
              role: membership.role,
            },
          };
        }

        // Tableau public pour utilisateur connecté
        if (board.isPublic) {
          data.connectionConfig.readOnly = true;
          return {
            user: {
              id: userId,
              name: session.user.name,
              email: session.user.email,
              role: 'reader',
            },
          };
        }
      }
    }

    // 3. Tableau public anonyme
    if (board.isPublic) {
      data.connectionConfig.readOnly = true;
      return {
        user: {
          id: `anon_${Math.random().toString(36).substring(2, 9)}`,
          name: 'Visiteur',
          role: 'reader',
        },
      };
    }

    throw new Error('Authentification requise pour accéder à ce tableau');
  },

  async onLoadDocument(data) {
    const boardId = data.documentName;

    // Charger le dernier snapshot depuis PostgreSQL
    const snapshot = await prisma.boardSnapshot.findFirst({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
    });

    const doc = new Y.Doc();

    if (snapshot) {
      Y.applyUpdate(doc, new Uint8Array(snapshot.data));

      // Charger les updates incrémentaux postérieurs au snapshot
      const updates = await prisma.boardUpdate.findMany({
        where: {
          boardId,
          createdAt: { gt: snapshot.createdAt },
        },
        orderBy: { createdAt: 'asc' },
      });

      for (const u of updates) {
        Y.applyUpdate(doc, new Uint8Array(u.update));
      }
    } else {
      const updates = await prisma.boardUpdate.findMany({
        where: { boardId },
        orderBy: { createdAt: 'asc' },
      });

      for (const u of updates) {
        Y.applyUpdate(doc, new Uint8Array(u.update));
      }
    }

    return doc;
  },

  async onStoreDocument(data) {
    const boardId = data.documentName;
    const state = Y.encodeStateAsUpdate(data.document);

    // Persister un snapshot consolidé
    await prisma.boardSnapshot.create({
      data: {
        boardId,
        data: Buffer.from(state),
        schemaVersion: 1,
      },
    });

    // Nettoyer les updates consolidés
    await prisma.boardUpdate.deleteMany({
      where: { boardId },
    });
  },

  async onRequest(data) {
    const { request, response } = data;
    const url = request.url || '';

    // Route de diagnostic
    if (url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok', server: 'hocuspocus-sync', port }));
      return Promise.reject();
    }

    // Endpoint de révocation immédiate (déconnecte les sessions actives du tableau)
    if (url === '/api/revoke' && request.method === 'POST') {
      let body = '';
      request.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      request.on('end', async () => {
        try {
          const { boardId } = JSON.parse(body);
          if (boardId) {
            await server.hocuspocus.closeConnections(boardId);
          }
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: true, message: 'Connexions révoquées et fermées' }));
        } catch (e: any) {
          response.writeHead(400, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: e.message }));
        }
      });
      return Promise.reject();
    }
  },
});

server.listen(port).then(() => {
  console.log(`📡 Serveur de synchronisation Hocuspocus démarré sur le port ${port}`);
});
