import { useRef, useEffect, useCallback } from 'react';
import styles from './Textarea.module.scss';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    onTextChange?: (value: string) => void;
    onEnter?: () => void;
    ignoreShiftEnter?: boolean;
    autoresize?: boolean;
}

export default function Textarea({ className, rows, onChange, onTextChange, onEnter, ignoreShiftEnter = true, style, autoresize = true, value, ...props }: TextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const classList = [styles.textarea, className].filter(Boolean).join(' ');

    style = { ...style, resize: autoresize ? 'none' : 'vertical' };

    const adjustHeight = useCallback(() => {
        if (textareaRef.current && autoresize) {
            textareaRef.current.style.overflow = 'hidden';
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [autoresize]);

    useEffect(() => {
        adjustHeight();
    }, [value, autoresize, adjustHeight]);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange?.(event);
        onTextChange?.(event.currentTarget.value);
        if (autoresize) {
            setTimeout(adjustHeight, 0);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const isShiftEnter = event.shiftKey && event.key === 'Enter';
        if (event.key === 'Enter' && (!ignoreShiftEnter || !isShiftEnter)) {
            onEnter?.();
            event.preventDefault();
            event.stopPropagation();
        }
    };

    return <textarea 
        ref={textareaRef} 
        className={classList} 
        onChange={handleChange} 
        onKeyDown={handleKeyDown}
        rows={autoresize ? 1 : rows}
        value={value} 
        style={style} 
        {...props} />;
}

