import { Lobby } from '@/pages/Lobby';
import { GameTable } from '@/pages/GameTable';
import { useGameStore } from '@/store/useGameStore';
import { GamePhase } from '@cyberbang/shared/types';

function App() {
  const gameState = useGameStore((s) => s.gameState);
  
  // Если игра активна (PLAYING), показываем стол. Иначе - лобби.
  const showGameTable = gameState?.phase === GamePhase.PLAYING;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans selection:bg-cyber-purple/30">
      {showGameTable ? (
        <GameTable />
      ) : (
        <Lobby />
      )}
    </div>
  );
}

export default App;