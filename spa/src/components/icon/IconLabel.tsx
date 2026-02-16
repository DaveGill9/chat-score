import Icon from "./Icon";
import styles from "./IconLabel.module.scss";

interface IconLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
    icon: string;
}

export default function IconLabel({ icon, children, className, ...props }: IconLabelProps) {
    const classList = [styles.iconLabel, className].filter(Boolean).join(' ');
    return (
        <span className={classList} {...props} >
            <Icon name={icon} />
            <span>{children}</span>
        </span>
    );
}