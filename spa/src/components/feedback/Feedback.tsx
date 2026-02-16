import Icon from "../icon/Icon.tsx";
import Loading from "./Loading.tsx";
import styles from "./Feedback.module.scss";

interface FeedbackProps extends React.HTMLAttributes<HTMLDivElement> {    
    type?: "info" | "success" | "error" | "empty" | "loading";
    icon?: string;
}

export default function Feedback(props: FeedbackProps) {

    const { type = "info", icon = "info", title, children, className, ...rest } = props;

    const classList = [styles.feedback, className].filter(Boolean).join(' ');

    if (type === "loading") {
        return (
            <div className={classList} {...rest}>
                <Loading />
            </div>
        );
    }

    let finalIcon: string = icon;
    switch (type) {
        case "success":
            finalIcon = "check";
            break;
        case "error":
            finalIcon = "error";
            break;
        case "info":
            finalIcon = "info";
            break;
        case "empty":
            finalIcon = "block";
            break;
    }

    return (
        <div className={classList} {...rest}>
            <Icon name={finalIcon} />
            { title && <h3>{title}</h3> }
            <div className={styles.content}>    
                {children}
            </div>
        </div>
    );
}