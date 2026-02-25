/**
 * ConsoleModal — opens noVNC console in a popup window
 */

interface Props {
  vmId: number;
  vmName?: string;
}

export default function ConsoleModal({ vmId, vmName }: Props) {
  const openConsole = () => {
    const url = `/vms/${vmId}/console`;
    const title = `Console — ${vmName ?? `VM #${vmId}`}`;
    window.open(url, title, 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
  };

  return (
    <button onClick={openConsole} className="btn-ghost text-xs">
      Open Console
    </button>
  );
}
