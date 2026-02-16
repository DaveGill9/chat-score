import Loading from "../feedback/Loading";
import Icon from "./Icon";
import { classList } from "../../utils";
import styles from "./IconButton.module.scss";

interface IconButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
    icon: string;
    working?: boolean;
    disabled?: boolean;
}

export default function IconButton({ icon, working = false, disabled = false, className, ...props }: IconButtonProps) {
    
    const classNames =  classList(
        styles.iconButton, 
        className, 
        disabled ? styles.disabled : undefined,
        working ? styles.working : undefined);

    return (
        <button className={classNames} {...props} type="button">
            <Icon name={icon} />
            { working && <Loading size="small" color="gray" className={styles.loading} /> }
        </button>
    );
}