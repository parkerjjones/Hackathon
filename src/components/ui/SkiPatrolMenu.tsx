import { SKI_PATROL_IDS, type SkiPatrolId } from '../../constants/skiPatrol';

interface SkiPatrolMenuProps {
  visible: boolean;
  selectedId: SkiPatrolId | null;
  onSelect: (id: SkiPatrolId) => void;
  isMobile?: boolean;
}

export default function SkiPatrolMenu({
  visible,
  selectedId,
  onSelect,
  isMobile = false,
}: SkiPatrolMenuProps) {
  if (!visible) return null;

  return (
    <div
      className={`fixed z-50 pointer-events-auto select-none ${
        isMobile ? 'top-16 left-3 right-3' : 'top-4 left-4 w-56'
      }`}
    >
      <div className="panel-glass rounded-lg overflow-hidden border border-wv-cyan/30">
        <div className="px-3 py-2 border-b border-wv-border">
          <span className="text-[10px] text-wv-cyan font-bold tracking-[0.2em] uppercase">
            SKI PATROL ID
          </span>
        </div>
        <div className="p-2 flex flex-col gap-1">
          {SKI_PATROL_IDS.map((id) => {
            const isActive = selectedId === id;
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                className={`px-2 py-2 rounded text-left text-[11px] font-mono tracking-wider transition-colors ${
                  isActive
                    ? 'text-wv-cyan bg-wv-cyan/15 ring-1 ring-wv-cyan/40'
                    : 'text-wv-muted hover:text-wv-text hover:bg-white/5'
                }`}
              >
                {id}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
