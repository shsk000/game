import { useGameStore } from './state/gameStore';
import { PlanScreen } from './features/plan/PlanScreen';
import { DevelopScreen } from './features/develop/DevelopScreen';
import { PolishScreen } from './features/polish/PolishScreen';
import { ReleaseScreen } from './features/release/ReleaseScreen';
import { OfficeScreen } from './features/office/OfficeScreen';
import { LibraryScreen } from './features/library/LibraryScreen';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  switch (screen) {
    case 'plan':    return <PlanScreen />;
    case 'develop': return <DevelopScreen />;
    case 'polish':  return <PolishScreen />;
    case 'release': return <ReleaseScreen />;
    case 'office':  return <OfficeScreen />;
    case 'library': return <LibraryScreen />;
    default:        return <PlanScreen />;
  }
}
