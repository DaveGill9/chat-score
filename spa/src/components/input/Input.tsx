import styles from './Input.module.scss';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onEnter?: () => void;
    onTextChange?: (value: string) => void;
}

export default function Input({ className, onChange, onEnter, onTextChange, ...props }: InputProps) {

    const classList = [styles.input, className].filter(Boolean).join(' ');

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(event);
        onTextChange?.(event.currentTarget.value);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            onEnter?.();
            event.preventDefault();
            event.stopPropagation();
        }
    };

    return <input className={classList} onChange={handleChange} onKeyDown={handleKeyDown} {...props} />;
}