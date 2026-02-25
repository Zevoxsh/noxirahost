/**
 * vmProvisioner — orchestre Proxmox + DB pour le cycle de vie des VMs
 */

import { database } from './database.js';
import { proxmoxService } from './proxmox.js';

class VmProvisioner {
  /**
   * Créer une VM/LXC dans Proxmox et en DB
   * @param {object} options
   * @param {number} options.userId
   * @param {object} options.plan - Ligne plans
   * @param {object} options.node - Ligne proxmox_nodes
   * @param {string} options.name - Nom de la VM
   * @param {string} options.rootPassword - Mot de passe root
   * @param {string} options.osTemplate - volid ISO ou template LXC
   */
  async create({ userId, plan, node, name, rootPassword, osTemplate }) {
    if (plan.vmType === 'lxc' && !osTemplate) {
      throw new Error('LXC template is required for provisioning');
    }
    const globalStart = parseInt(process.env.PROXMOX_VMID_START || '200', 10);
    const minStart = Number.isFinite(node.vmid_start) ? node.vmid_start : globalStart;

    // Générer le prochain VMID disponible côté Proxmox (retry en cas de course)
    const hostname = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    let dbVm = null;
    let vmid = null;
    let usedVmids = null;
    try {
      const result = await proxmoxService.getNextAvailableVmid(node, minStart);
      vmid = result.vmid;
      usedVmids = result.used;
    } catch {
      // fallback local si Proxmox est indispo
      vmid = await database.getNextVmid(node.id);
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (vmid === null) vmid = await database.getNextVmid(node.id);
      if (usedVmids && usedVmids.has(vmid)) {
        vmid += 1;
        continue;
      }
      try {
        dbVm = await database.createVM({
          userId,
          nodeId: node.id,
          planId: plan.id,
          vmid,
          vmType: plan.vmType,
          name,
          hostname,
          osTemplate,
          cpuCores: plan.cpuCores,
          ramMb: plan.ramMb,
          diskGb: plan.diskGb
        });
        break;
      } catch (error) {
        if (error?.code === '23505') continue;
        throw error;
      }
    }
    if (!dbVm) throw new Error('Unable to allocate a unique VMID');

    try {
      // Créer dans Proxmox
      if (plan.vmType === 'kvm') {
        const params = proxmoxService.buildVMCreateParams(
          vmid, plan, osTemplate, name, node.storage, node.bridge, rootPassword
        );
        await proxmoxService.createVM(node, params);
      } else {
        const params = proxmoxService.buildContainerCreateParams(
          vmid, plan, osTemplate, hostname, node.storage, node.bridge, rootPassword
        );
        await proxmoxService.createContainer(node, params);
      }

      // Mettre à jour le statut en DB
      await database.updateVMStatus(dbVm.id, 'stopped');
      return await database.getVMById(dbVm.id);
    } catch (error) {
      // Marquer comme erreur si la création PVE échoue
      await database.updateVMStatus(dbVm.id, 'error');
      throw error;
    }
  }

  /**
   * Supprimer une VM de Proxmox et la marquer comme supprimée en DB
   */
  async destroy(vm) {
    const node = await database.getNodeById(vm.node_id);
    if (!node) throw new Error('Node not found');

    await database.softDeleteVM(vm.id);

    try {
      if (vm.vm_type === 'kvm') {
        await proxmoxService.deleteVM(node, vm.vmid);
      } else {
        await proxmoxService.deleteContainer(node, vm.vmid);
      }
    } catch (error) {
      // Log l'erreur mais ne pas planter (la VM est déjà marquée supprimée)
      console.error(`[Provisioner] Failed to delete VM ${vm.vmid} from PVE:`, error.message);
    }
  }

  /**
   * Suspendre une VM (arrêter + marquer suspendue)
   */
  async suspend(vm) {
    const node = await database.getNodeById(vm.node_id);
    if (!node) return;

    try {
      await proxmoxService.powerAction(node, vm.vmid, vm.vm_type, 'stop');
    } catch (error) {
      console.warn(`[Provisioner] Could not stop VM ${vm.vmid}:`, error.message);
    }

    await database.updateVM(vm.id, { isSuspended: true, status: 'suspended' });
  }

  /**
   * Reprendre une VM suspendue
   */
  async resume(vm) {
    const node = await database.getNodeById(vm.node_id);
    if (!node) return;

    await database.updateVM(vm.id, { isSuspended: false, status: 'stopped' });
  }
}

export const vmProvisioner = new VmProvisioner();
