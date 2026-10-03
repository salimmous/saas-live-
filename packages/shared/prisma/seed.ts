import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import * as Y from 'yjs';

const prisma = new PrismaClient();

// Hash standard compatible avec Better-Auth scrypt
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

async function main() {
  console.log('🌱 Démarrage du seed de la base de données...');

  const demoEmail = 'demo@whiteboard.local';
  const rawPassword = 'Password123!';
  const hashedPassword = hashPassword(rawPassword);

  // 1. Créer ou récupérer l'utilisateur de démo
  let demoUser = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        name: 'Utilisateur Démo',
        email: demoEmail,
        emailVerified: true,
      },
    });

    // Créer le compte d'authentification lié
    await prisma.account.create({
      data: {
        userId: demoUser.id,
        accountId: demoUser.id,
        providerId: 'credential',
        password: hashedPassword,
      },
    });

    console.log(`✅ Compte démo créé : ${demoEmail} / ${rawPassword}`);
  } else {
    console.log(`ℹ️ Compte démo existant : ${demoEmail}`);
  }

  // 2. Créer le tableau de démo avec 500 objets
  const existingBoard = await prisma.board.findFirst({
    where: {
      ownerId: demoUser.id,
      title: 'Tableau Démo (500 objets)',
    },
  });

  if (!existingBoard) {
    const board = await prisma.board.create({
      data: {
        title: 'Tableau Démo (500 objets)',
        description: 'Tableau de référence avec 500 éléments pour tester la performance à 50+ FPS, la synchronisation et le culling.',
        ownerId: demoUser.id,
        isPublic: true,
      },
    });

    // Générer 500 objets dans un document Yjs
    const ydoc = new Y.Doc();
    const yElements = ydoc.getMap('elements');

    const categories = ['Frontend', 'Backend', 'DevOps', 'Design System', 'Intelligence Artificielle'];
    const colors = ['#fef08a', '#bbf7d0', '#bae6fd', '#fed7aa', '#fbcfe8'];

    const totalCols = 25;
    const totalRows = 20; // 25 * 20 = 500 objets

    const cellWidth = 200;
    const cellHeight = 140;
    const spacingX = 40;
    const spacingY = 40;

    const elementIds: string[] = [];

    ydoc.transact(() => {
      let count = 0;
      for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < totalCols; c++) {
          count++;
          const id = `demo-node-${count}`;
          elementIds.push(id);

          const posX = 100 + c * (cellWidth + spacingX);
          const posY = 100 + r * (cellHeight + spacingY);
          const catIdx = (r + c) % categories.length;

          // Varier entre sticky, shape et text
          const typeChoice = count % 4;

          let elementData: any;
          if (typeChoice === 0) {
            elementData = {
              id,
              type: 'shape',
              shapeType: 'rectangle',
              x: posX,
              y: posY,
              width: cellWidth,
              height: cellHeight,
              zIndex: count,
              content: `Composant #${count} (${categories[catIdx]})`,
              style: {
                fill: colors[catIdx],
                stroke: '#334155',
                strokeWidth: 2,
                strokeStyle: 'solid',
                color: '#1e293b',
              },
              meta: { createdAt: Date.now(), updatedAt: Date.now() },
            };
          } else if (typeChoice === 1) {
            elementData = {
              id,
              type: 'shape',
              shapeType: 'circle',
              x: posX,
              y: posY,
              width: cellHeight,
              height: cellHeight,
              zIndex: count,
              content: `API #${count}`,
              style: {
                fill: colors[catIdx],
                stroke: '#0f766e',
                strokeWidth: 2,
                strokeStyle: 'solid',
                color: '#134e4a',
              },
              meta: { createdAt: Date.now(), updatedAt: Date.now() },
            };
          } else {
            elementData = {
              id,
              type: 'sticky',
              x: posX,
              y: posY,
              width: cellWidth,
              height: cellHeight,
              zIndex: count,
              content: `Idée #${count} : Optimiser le flux ${categories[catIdx]} avec architecture modulaire et rendu sans latence.`,
              style: {
                color: colors[catIdx],
                fontSize: 14,
                textAlign: 'left',
              },
              meta: { createdAt: Date.now(), updatedAt: Date.now() },
            };
          }

          yElements.set(id, elementData);
        }
      }

      // Ajouter une série de connecteurs entre nœuds consécutifs
      for (let i = 1; i < 40; i++) {
        const connId = `demo-conn-${i}`;
        const fromId = elementIds[i * 2];
        const toId = elementIds[i * 2 + 1];
        if (fromId && toId) {
          yElements.set(connId, {
            id: connId,
            type: 'connector',
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            zIndex: 1000 + i,
            fromId,
            toId,
            fromAnchor: 'right',
            toAnchor: 'left',
            startEnd: 'none',
            endEnd: 'arrow',
            label: `Lien ${i}`,
            routing: 'orthogonal',
            style: {
              stroke: '#64748b',
              strokeWidth: 2,
              strokeStyle: 'solid',
            },
            meta: { createdAt: Date.now(), updatedAt: Date.now() },
          });
        }
      }
    });

    // Encoder l'état Yjs sous forme de snapshot binaire
    const snapshotUpdate = Y.encodeStateAsUpdate(ydoc);

    await prisma.boardSnapshot.create({
      data: {
        boardId: board.id,
        data: Buffer.from(snapshotUpdate),
        schemaVersion: 1,
      },
    });

    console.log(`✅ Tableau démo créé avec 500+ objets : ${board.id} (${board.title})`);
  } else {
    console.log(`ℹ️ Tableau démo déjà existant : ${existingBoard.id}`);
  }

  console.log('🚀 Seed terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
