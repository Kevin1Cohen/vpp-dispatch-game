// ============================================
// VPP Simulation Game - Main App Component
// ============================================

import { GameProvider, useGame } from './context/GameContext';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { RulesScreen } from './components/screens/RulesScreen';
import { SetupScreen } from './components/screens/SetupScreen';
import { SimulationScreen } from './components/screens/SimulationScreen';
import { ResultsScreen } from './components/screens/ResultsScreen';
import './styles/global.css';

function GameRouter() {
  const { state } = useGame();

  switch (state.screen) {
    case 'welcome':
      return <WelcomeScreen />;
    case 'rules':
      return <RulesScreen />;
    case 'setup':
      return <SetupScreen />;
    case 'simulation':
      return <SimulationScreen />;
    case 'results':
      return <ResultsScreen />;
    default:
      return <WelcomeScreen />;
  }
}

function App() {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}

export default App;
