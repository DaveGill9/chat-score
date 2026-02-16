import { useRouteError, useNavigate } from "react-router-dom";
import Button from "../../components/button/Button.tsx";
import Icon from "../../components/icon/Icon.tsx";
import styles from "./ErrorPage.module.scss";

export default function ErrorPage() {

  const error = useRouteError() as { 
    message: string, 
    stack: string, 
    status: number,
  };
  const navigate = useNavigate();

  if (error.status === 404) {
    return (
      <div className={styles.errorPage}>
        <Icon name="bug_report" />
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist.</p>
        <br/>
        <Button type="button" onClick={() => navigate('/')} variant="accent">Back to Homepage</Button>
      </div>
    );
  }

  return (
    <div className={styles.errorPage}>
      <Icon name="bug_report" />
      <h1>Whoops! Something went wrong.</h1>
      {error.message && <pre>{error.stack}</pre>}
      <Button type="button" onClick={() => navigate('/')} variant="accent">Back to Homepage</Button>
    </div>
  );
}