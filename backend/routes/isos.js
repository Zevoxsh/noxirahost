/**
 * Routes ISOs & Templates — /api/isos, /api/templates
 * Scan TOUS les storages du noeud pour trouver ISOs et templates CT
 */

import { database } from '../services/database.js';
import { proxmoxService } from '../services/proxmox.js';

export async function isoRoutes(fastify) {
  // GET /api/isos — liste des ISOs disponibles
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const isos = await database.getActiveIsos();
    reply.send({ isos });
  });

  // POST /api/isos/sync — synchroniser depuis tous les storages Proxmox (admin)
  fastify.post('/sync', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const nodes = await database.getActiveNodes();
    let synced = 0;
    const errors = [];

    for (const node of nodes) {
      try {
        // Scanner tous les storages qui supportent les ISOs
        const storageGroups = await proxmoxService.scanAllStoragesForContent(node, 'iso');

        for (const { storage, items } of storageGroups) {
          for (const item of items) {
            await database.upsertIso({
              nodeId: node.id,
              storage,
              volid: item.volid,
              filename: item.volid.split('/').pop(),
              sizeBytes: item.size || null
            });
            synced++;
          }
        }
      } catch (err) {
        fastify.log.warn({ node: node.name, err: err.message }, 'ISO sync failed for node');
        errors.push({ node: node.name, error: err.message });
      }
    }

    reply.send({ success: true, synced, errors });
  });
}

export async function templateRoutes(fastify) {
  // GET /api/templates — liste des templates LXC
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const templates = await database.getActiveLxcTemplates();
    reply.send({ templates });
  });

  // POST /api/templates/sync — synchroniser depuis tous les storages (admin)
  fastify.post('/sync', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const nodes = await database.getActiveNodes();
    let synced = 0;
    const errors = [];

    for (const node of nodes) {
      try {
        // Scanner tous les storages qui supportent les templates CT (vztmpl)
        const storageGroups = await proxmoxService.scanAllStoragesForContent(node, 'vztmpl');

        for (const { storage, items } of storageGroups) {
          for (const item of items) {
            const filename = item.volid.split('/').pop();

            // Détecter l'OS depuis le nom du fichier
            let osType = 'unknown';
            const fn = filename.toLowerCase();
            if (fn.includes('ubuntu')) osType = 'ubuntu';
            else if (fn.includes('debian')) osType = 'debian';
            else if (fn.includes('centos')) osType = 'centos';
            else if (fn.includes('alpine')) osType = 'alpine';
            else if (fn.includes('fedora')) osType = 'fedora';
            else if (fn.includes('archlinux') || fn.includes('arch')) osType = 'archlinux';
            else if (fn.includes('rocky')) osType = 'rocky';
            else if (fn.includes('almalinux') || fn.includes('alma')) osType = 'almalinux';

            await database.upsertLxcTemplate({
              nodeId: node.id,
              storage,
              volid: item.volid,
              filename,
              osType
            });
            synced++;
          }
        }
      } catch (err) {
        fastify.log.warn({ node: node.name, err: err.message }, 'Template sync failed for node');
        errors.push({ node: node.name, error: err.message });
      }
    }

    reply.send({ success: true, synced, errors });
  });
}
