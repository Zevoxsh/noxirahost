import type { VMStatus } from '../../types';

const MAP: Record<VMStatus, { cls: string; label: string; dot: string }> = {
  running:      { cls: 'badge-running',      label: 'En ligne',       dot: 'dot-green' },
  stopped:      { cls: 'badge-stopped',      label: 'Arrêté',         dot: 'dot-gray' },
  suspended:    { cls: 'badge-suspended',    label: 'Suspendu',       dot: 'dot-orange' },
  error:        { cls: 'badge-error',        label: 'Erreur',         dot: 'dot-red' },
  provisioning: { cls: 'badge-provisioning', label: 'Déploiement...', dot: 'dot-amber' },
  deleting:     { cls: 'badge-deleting',     label: 'Suppression...', dot: 'dot-red' },
};

export default function StatusBadge({ status }: { status: VMStatus }) {
  const m = MAP[status] ?? { cls: 'badge-stopped', label: status, dot: 'dot-gray' };
  return (
    <span className={m.cls}>
      <span className={`${m.dot} ${status === 'provisioning' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  );
}
