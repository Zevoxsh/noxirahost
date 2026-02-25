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
   * @param {string} options.osTemplate - volid ISO ou template LXC
   */
  async create({ userId, plan, node, name, osTemplate }) {
    // Générer le prochain VMID disponible
    const vmid = await database.getNextVmid(node.id);
    const hostname = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Créer l'entrée DB en "provisioning"
    const dbVm = await database.createVM({
      userId,
      nodeId: node.id,
      planId: plan.id,
      vmid,
      vmType: plan.vm_type,
      name,
      hostname,
      osTemplate,
      cpuCores: plan.cpu_cores,
      ramMb: plan.ram_mb,
      diskGb: plan.disk_gb
    });

    try {
      // Créer dans Proxmox
      if (plan.vm_type === 'kvm') {
        const params = proxmoxService.buildVMCreateParams(
          vmid, plan, osTemplate, name, node.storage, node.bridge
        );
        await proxmoxService.createVM(node, params);
      } else {
        const params = proxmoxService.buildContainerCreateParams(
          vmid, plan, osTemplate, hostname, node.storage, node.bridge
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
