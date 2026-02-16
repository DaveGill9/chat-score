import styles from './LoginPage.module.scss';
import Button from '../../components/button/Button';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../services/toast-service';

export default function LoginPage() {

    const { login, working } = useAuth();

    const handleLogin = async () => {
        try {
            await login();
        } 
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to login';
            toast.error(errorMessage);
        }
    };

    return (
        <div className={styles.loginPage}>
            <div className={styles.login}>
                <img src="/logo.svg" />
                <h1>Chat Jumpstart</h1>
                <p className={styles.prompt}>
                    <strong>Sign in</strong> to continue
                </p>              
                <p className={styles.loginButton}>
                    <Button type="button" working={working} onClick={handleLogin} variant="accent">Login with Microsoft</Button>
                </p>
            </div>
        </div>
    );
}