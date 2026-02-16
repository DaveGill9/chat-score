import { useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import Button from "../button/Button";
import Icon from "../icon/Icon";
import { Alert, Popover } from "../popover";
import styles from "./SettingsMenu.module.scss";

export default function SettingsMenu() {

    const { theme, setTheme } = useTheme();
    const { logout } = useAuth();
    const [confirmLogout, setConfirmLogout] = useState(false);

    const menu = (
        <>
            <div className={styles.theme}>
                <Button type="block" onClick={() => setTheme('dark')} className={theme === 'dark' ? styles.active : ''}><Icon name="dark_mode" /> Dark mode</Button>
                <Button type="block" onClick={() => setTheme('light')} className={theme === 'light' ? styles.active : ''}><Icon name="light_mode" /> Light mode</Button>
                <Button type="block" onClick={() => setTheme('')} className={theme === '' ? styles.active : ''}><Icon name="monitor" /> System theme</Button>
            </div>
            <div className={styles.logout}>
                <Button type="button" variant="accent" onClick={() => setConfirmLogout(true)}>Logout</Button>
            </div>
        </>
    );

    return (
        <>
            <Popover
                menu={menu}
                className={styles.settings}
                selectedClassName={styles.active}
                position="top"
                anchor="left">
                <Button type="flex" className={styles.button}>
                    <Icon name="settings" />
                    Settings
                </Button>
            </Popover>

            <Alert
                title="Logout"
                children="Are you sure you want to logout?"
                visible={confirmLogout}
                setVisible={setConfirmLogout}
                onConfirm={logout}
            />
        </>
    );
}