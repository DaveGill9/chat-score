import { classList } from "../../utils/class-list";
import styles from "./Chip.module.scss";

export default function Chip({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
    return <span className={classList(styles.chip, className)} {...props}>{children}</span>;
}