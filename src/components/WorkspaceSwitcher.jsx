export default function WorkspaceSwitcher({ workspaces, activeId, onSwitch }) {
  if (!workspaces.length) return null;
  const active = workspaces.find(ws => ws.id === activeId);
  return (
    <div className="p-2 border-b">
      <select
        className="w-full p-1 border rounded text-sm"
        value={activeId || ''}
        onChange={(e) => onSwitch(e.target.value)}
      >
        {workspaces.map(ws => (
          <option key={ws.id} value={ws.id}>{ws.name}</option>
        ))}
      </select>
    </div>
  );
}
