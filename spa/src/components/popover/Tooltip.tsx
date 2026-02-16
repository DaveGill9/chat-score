import Popover from './Popover';
import styles from './Tooltip.module.scss';

interface TooltipProps {
    className?: string;
    text: string;
    children: React.ReactElement;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ children, className, text, position = 'top' }: TooltipProps) {

    const classList = [styles.tooltip, className].filter(Boolean).join(' ');

    const tip = <div className={classList}>{text}</div>;

    return (
        <Popover 
            menu={tip} 
            position={position} 
            trigger="hover"
            offset={10}>
            {children}
        </Popover>
    );
}