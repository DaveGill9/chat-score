import { useAppUpdate } from './hooks/useAppUpdate';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import Navigation from './components/navigation/Navigation';
import LoginPage from './pages/login/LoginPage';
import styles from './App.module.scss';
import AnimatedOutlet from './components/layout/AnimatedOutlet';
import Feedback from './components/feedback/Feedback';

function App() {

  useAppUpdate();
  useTheme();
  const { user } = useAuth();

  if (user === undefined) {
    return <Feedback type="loading" />;
  }
  
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className={styles.app}>
      <Navigation className={styles.navigation} />
      <main className={styles.main}>
        <AnimatedOutlet />
      </main>
      <aside className={styles.aside} id="popover-container" />
    </div>
  );
}

export default App;