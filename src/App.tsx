import { CollectionScreen } from './features/collection/CollectionScreen';
import { DevelopScreen } from './features/develop/DevelopScreen';
import { LibraryScreen } from './features/library/LibraryScreen';
import { OfficeScreen } from './features/office/OfficeScreen';
import { PlanScreen } from './features/plan/PlanScreen';
import { ReleaseScreen } from './features/release/ReleaseScreen';
import { useGameStore } from './state/gameStore';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  switch (screen) {
    case 'plan':
      return <PlanScreen />;
    case 'develop':
      return <DevelopScreen />;
    case 'release':
      return <ReleaseScreen />;
    case 'office':
      return <OfficeScreen />;
    case 'library':
      return <LibraryScreen />;
    case 'collection':
      return <CollectionScreen />;
    default:
      return <PlanScreen />;
  }
}
