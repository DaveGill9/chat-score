import Button from "../button/Button";
import Icon from "../icon/Icon";
import styles from "./Alert.module.scss";
import Modal from "./Modal";

interface AlertProps {
    title: string;
    children: React.ReactNode;
    visible: boolean;
    setVisible: (visible: boolean) => void;
    confirmText?: string;
    onConfirm?: () => void;
}

export default function Alert(props: AlertProps) {

    const {
        title,
        children,
        visible,
        setVisible,
        confirmText = "Confirm",
        onConfirm,
    } = props;

    return (
        <Modal visible={visible} className={styles.alert}>
            <div className={styles.header}>
                <Icon name="info" />
                {title}
            </div>
            <div className={styles.content}>
                {children}
            </div>
            <div className={styles.actions}>
                <Button type="button" onClick={() => setVisible(false)} variant="border">Close</Button>
                {onConfirm && <Button type="button" onClick={() => { onConfirm(); setVisible(false); }} variant="accent">{confirmText}</Button>}
            </div>
        </Modal>
    );
}